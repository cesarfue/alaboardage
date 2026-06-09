import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface GeoCommune {
  _score: number;
  departement: { code: string };
}

interface GeoRegion {
  code: string;
}

type LocationScope =
  | { type: 'departement'; code: string }
  | { type: 'region'; code: string };

interface SireneEtablissement {
  siret: string;
  adresse: string;
  libelle_commune: string;
  latitude: string | null;
  longitude: string | null;
  etat_administratif: string;
}

interface SireneResult {
  nom_complet: string;
  matching_etablissements: SireneEtablissement[];
}


class RateLimiter {
  private queue = Promise.resolve();
  private readonly minIntervalMs: number;
  private lastCallAt = 0;

  constructor(maxPerSecond: number) {
    this.minIntervalMs = Math.ceil(1000 / maxPerSecond);
  }

  acquire(): Promise<void> {
    const prev = this.queue;
    let release!: () => void;
    this.queue = new Promise((r) => (release = r));
    return prev.then(() => {
      const wait = this.minIntervalMs - (Date.now() - this.lastCallAt);
      return (
        wait > 0
          ? new Promise<void>((r) => setTimeout(r, wait))
          : Promise.resolve()
      ).then(() => {
        this.lastCallAt = Date.now();
        release();
      });
    });
  }
}

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);
  // geo.api.gouv.fr limit: 50 req/s per IP — stay strictly below
  private readonly geoLimiter = new RateLimiter(45);
  // global queue: only one enrichJobs batch runs at a time across all boards
  private enrichQueue = Promise.resolve();
  private generation = 0;

  constructor(private readonly prisma: PrismaService) {}

  async backfill(
    limit?: number,
  ): Promise<{ processed: number; enriched: number }> {
    const jobs = await this.prisma.job.findMany({
      where: { establishmentId: null },
      select: { id: true, company: true, location: true },
      take: limit,
    });

    const before = await this.prisma.job.count({
      where: { establishmentId: { not: null } },
    });

    await this.enrichJobs(jobs);

    const after = await this.prisma.job.count({
      where: { establishmentId: { not: null } },
    });

    return { processed: jobs.length, enriched: after - before };
  }

  cancelEnrichment(): void {
    this.generation++;
    this.enrichQueue = Promise.resolve();
  }

  enrichJobs(
    jobs: { id: string; company: string; location: string }[],
  ): Promise<void> {
    const gen = this.generation;
    this.enrichQueue = this.enrichQueue
      .catch(() => {})
      .then(() => this.runEnrichJobs(jobs, gen));
    return this.enrichQueue;
  }

  private async runEnrichJobs(
    jobs: { id: string; company: string; location: string }[],
    gen: number,
  ) {
    for (const job of jobs) {
      if (this.generation !== gen) return;
      const result = await this.resolveEstablishment(job).catch(
        (err: Error) => {
          this.logger.error(`Failed to resolve ${job.id}: ${err.message}`);
          return null;
        },
      );
      if (this.generation !== gen) return;
      if (result) {
        await this.saveEnrichment(result).catch((err: Error) =>
          this.logger.error(`Failed to save enrichment: ${err.message}`),
        );
      }
    }
  }

  async enrichJob(job: { id: string; company: string; location: string }) {
    const result = await this.resolveEstablishment(job);
    if (result) await this.saveEnrichment(result);
  }

  private async resolveEstablishment(job: {
    id: string;
    company: string;
    location: string;
  }) {
    const scope = await this.resolveScope(job.location);
    if (!scope) {
      this.logger.warn(`No geo scope for location "${job.location}"`);
      return null;
    }

    const found = await this.findEstablishment(job.company, scope);
    if (!found) {
      this.logger.warn(
        `No establishment for "${job.company}" (${scope.type}=${scope.code})`,
      );
      return null;
    }

    return { jobId: job.id, etab: found.etab, name: found.name };
  }

  private async resolveScope(location: string): Promise<LocationScope | null> {
    const tokens = location
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2);
    for (const token of tokens) {
      const scope = await this.tokenToScope(token);
      if (scope) return scope;
    }
    return null;
  }

  private async fetchWithRetry(
    url: string,
    label: string,
    retries = 3,
  ): Promise<Response | null> {
    let delay = 2000;
    for (let attempt = 1; attempt <= retries; attempt++) {
      const res = await fetch(url).catch(() => null);
      if (res?.ok) return res;
      const shouldRetry = attempt < retries;
      if (!res) {
        if (!shouldRetry) return null;
        this.logger.warn(
          `Network error on ${label}, retry ${attempt}/${retries} in ${delay}ms`,
        );
      } else if (res.status === 429) {
        if (!shouldRetry) {
          this.logger.warn(`HTTP 429 on ${label}`);
          return null;
        }
        this.logger.warn(
          `429 on ${label}, retry ${attempt}/${retries} in ${delay}ms`,
        );
      } else {
        this.logger.warn(`HTTP ${res.status} on ${label}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
    return null;
  }

  private async tokenToScope(token: string): Promise<LocationScope | null> {
    const communes = await this.geoLimiter
      .acquire()
      .then(() =>
        this.fetchWithRetry(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(token)}&fields=departement&boost=population&limit=1`,
          `geo communes "${token}"`,
        ),
      )
      .then((r) => (r ? (r.json() as Promise<GeoCommune[]>) : []))
      .catch(() => [] as GeoCommune[]);

    if (communes[0]?.departement?.code)
      return { type: 'departement', code: communes[0].departement.code };

    const regions = await this.geoLimiter
      .acquire()
      .then(() =>
        this.fetchWithRetry(
          `https://geo.api.gouv.fr/regions?nom=${encodeURIComponent(token)}&limit=1`,
          `geo regions "${token}"`,
        ),
      )
      .then((r) => (r ? (r.json() as Promise<GeoRegion[]>) : []))
      .catch(() => [] as GeoRegion[]);

    if (regions[0]?.code) return { type: 'region', code: regions[0].code };
    return null;
  }

  private async saveEnrichment(result: {
    jobId: string;
    etab: SireneEtablissement;
    name: string;
  }) {
    const { jobId, etab, name } = result;

    await this.prisma.establishment.upsert({
      where: { siret: etab.siret },
      create: {
        siret: etab.siret,
        name,
        address: etab.adresse,
        city: etab.libelle_commune,
        lat: parseFloat(etab.latitude!),
        lng: parseFloat(etab.longitude!),
      },
      update: {},
    });

    await this.prisma.job.update({
      where: { id: jobId },
      data: { establishmentId: etab.siret },
    });

    this.logger.log(`Enriched job ${name} → (${etab.adresse})`);
  }

  private async findEstablishment(
    company: string,
    scope: LocationScope,
  ): Promise<{ etab: SireneEtablissement; name: string } | null> {
    const result = await this.querySirene(company, scope);
    if (result) return result;

    const simplified = this.simplifyCompanyName(company);
    if (simplified !== company) return this.querySirene(simplified, scope);

    return null;
  }

  private async querySirene(
    company: string,
    scope: LocationScope,
  ): Promise<{ etab: SireneEtablissement; name: string } | null> {
    const geoParam =
      scope.type === 'departement'
        ? `departement=${scope.code}`
        : `region=${scope.code}`;
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(company)}&${geoParam}&limite=20`;
    const res = await this.fetchWithRetry(
      url,
      `Sirene "${company}" (${geoParam})`,
    );
    if (!res) return null;
    const data: { results: SireneResult[] } = await res.json();

    for (const result of data.results) {
      const etab = result.matching_etablissements.find(
        (e) =>
          e.etat_administratif === 'A' &&
          !!e.latitude &&
          e.latitude !== '[NON-DIFFUSIBLE]' &&
          !isNaN(parseFloat(e.latitude)),
      );
      if (etab) return { etab, name: result.nom_complet };
    }
    return null;
  }

  private simplifyCompanyName(name: string): string {
    const prefixes = ['Groupe ', 'Group ', 'Cabinet ', 'Société '];
    const suffixes = [
      ' Experts',
      ' Consulting',
      ' Group',
      ' Groupe',
      ' France',
      ' RH',
      ' SAS',
      ' SA',
      ' SARL',
    ];

    let s = name;
    for (const p of prefixes) {
      if (s.startsWith(p)) {
        s = s.slice(p.length);
        break;
      }
    }
    for (const suf of suffixes) {
      if (s.endsWith(suf)) {
        s = s.slice(0, -suf.length);
        break;
      }
    }
    return s.trim();
  }
}
