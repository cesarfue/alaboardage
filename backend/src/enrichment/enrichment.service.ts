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

const CONCURRENCY = 1;
const BATCH_DELAY_MS = 300;

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

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

  async enrichJobs(jobs: { id: string; company: string; location: string }[]) {
    // Fetch API data in parallel, then write to DB serially (SQLite can't handle concurrent writes)
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      if (i > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      const batch = jobs.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((job) =>
          this.resolveEstablishment(job).catch((err: Error) => {
            this.logger.error(`Failed to resolve ${job.id}: ${err.message}`);
            return null;
          }),
        ),
      );

      for (const result of results) {
        if (!result) continue;
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
      if (!res) return null;
      if (res.ok) return res;
      if (res.status === 429 && attempt < retries) {
        this.logger.warn(
          `429 on ${label}, retry ${attempt}/${retries} in ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      this.logger.warn(`HTTP ${res.status} on ${label}`);
      return null;
    }
    return null;
  }

  private async tokenToScope(token: string): Promise<LocationScope | null> {
    const [communes, regions] = await Promise.all([
      this.fetchWithRetry(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(token)}&fields=departement&boost=population&limit=1`,
        `geo communes "${token}"`,
      )
        .then((r) => (r ? (r.json() as Promise<GeoCommune[]>) : []))
        .catch(() => [] as GeoCommune[]),
      this.fetchWithRetry(
        `https://geo.api.gouv.fr/regions?nom=${encodeURIComponent(token)}&limit=1`,
        `geo regions "${token}"`,
      )
        .then((r) => (r ? (r.json() as Promise<GeoRegion[]>) : []))
        .catch(() => [] as GeoRegion[]),
    ]);

    if (communes[0]?.departement?.code)
      return { type: 'departement', code: communes[0].departement.code };
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

    this.logger.log(`Enriched job ${jobId} → ${etab.siret} (${etab.adresse})`);
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
