import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import type { Establishment } from '../../generated/prisma/client';

type OnEnriched = (jobId: string, establishment: Establishment) => void;

interface GeoData {
  communes: { n: string; d: string; r: string; p: number }[];
  regions: { n: string; code: string }[];
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


/** Normalise un nom pour le matching : minuscules, sans accents, alphanum. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

@Injectable()
export class EnrichmentService implements OnModuleInit {
  private readonly logger = new Logger(EnrichmentService.name);
  // Index en mémoire du découpage administratif (cf. `make import-geo`).
  private readonly communeToScope = new Map<string, { dep: string; reg: string }>();
  private readonly communePop = new Map<string, number>();
  private readonly regionToCode = new Map<string, string>();
  // global queue: only one enrichJobs batch runs at a time across all boards
  private enrichQueue = Promise.resolve();
  private generation = 0;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const path = join(process.cwd(), 'data', 'communes.json');
    try {
      const { communes, regions } = JSON.parse(
        readFileSync(path, 'utf8'),
      ) as GeoData;
      // En cas d'homonymes, garder la commune la plus peuplée (mime boost=population).
      for (const c of communes) {
        const key = normalize(c.n);
        if (c.p > (this.communePop.get(key) ?? -1)) {
          this.communePop.set(key, c.p);
          this.communeToScope.set(key, { dep: c.d, reg: c.r });
        }
      }
      for (const r of regions) this.regionToCode.set(normalize(r.n), r.code);
      this.logger.log(
        `Loaded ${communes.length} communes, ${regions.length} regions`,
      );
    } catch {
      this.logger.error(
        `Could not load ${path} — run 'make import-geo'. Scope resolution disabled.`,
      );
    }
  }

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
    onEnriched?: OnEnriched,
    label = 'unknown',
  ): Promise<void> {
    const gen = this.generation;
    this.enrichQueue = this.enrichQueue
      .catch(() => {})
      .then(() => this.runEnrichJobs(jobs, gen, onEnriched, label));
    return this.enrichQueue;
  }

  private async runEnrichJobs(
    jobs: { id: string; company: string; location: string }[],
    gen: number,
    onEnriched?: OnEnriched,
    label = 'unknown',
  ) {
    let enriched = 0;
    let noScope = 0;
    let noMatch = 0;

    for (const job of jobs) {
      if (this.generation !== gen) {
        this.logger.warn(`[${label}] enrichment cancelled after ${enriched}/${jobs.length}`);
        return;
      }
      const result = await this.resolveEstablishment(job).catch((err: Error) => {
        this.logger.error(`[${label}] resolve error for job ${job.id}: ${err.message}`);
        return { success: false as const, reason: 'error' as const };
      });
      if (this.generation !== gen) {
        this.logger.warn(`[${label}] enrichment cancelled after ${enriched}/${jobs.length}`);
        return;
      }
      if (!result.success) {
        if (result.reason === 'no-scope') noScope++;
        else if (result.reason === 'no-match') noMatch++;
      } else {
        await this.saveEnrichment(result, onEnriched).catch((err: Error) =>
          this.logger.error(`[${label}] save error: ${err.message}`),
        );
        enriched++;
      }
    }

    const pct = jobs.length > 0 ? Math.round((enriched / jobs.length) * 100) : 0;
    this.logger.log(
      `[${label}] ${enriched}/${jobs.length} enriched (${pct}%)` +
      (noScope > 0 ? ` — ${noScope} no geo scope` : '') +
      (noMatch > 0 ? ` — ${noMatch} no Sirene match` : ''),
    );
  }

  async enrichJob(job: { id: string; company: string; location: string }) {
    const result = await this.resolveEstablishment(job);
    if (result.success) await this.saveEnrichment(result);
  }

  private async resolveEstablishment(job: {
    id: string;
    company: string;
    location: string;
  }): Promise<
    | { success: true; jobId: string; etab: SireneEtablissement; name: string }
    | { success: false; reason: 'no-scope' | 'no-match' }
  > {
    const scope = this.resolveScope(job.location);
    if (!scope) return { success: false, reason: 'no-scope' };

    const found = await this.findEstablishment(job.company, scope);
    if (!found) return { success: false, reason: 'no-match' };

    return { success: true, jobId: job.id, etab: found.etab, name: found.name };
  }

  private resolveScope(location: string): LocationScope | null {
    const tokens = location
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2);
    for (const token of tokens) {
      const scope = this.tokenToScope(token);
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

  private tokenToScope(token: string): LocationScope | null {
    const key = normalize(token);
    const commune = this.communeToScope.get(key);
    if (commune) return { type: 'departement', code: commune.dep };

    const region = this.regionToCode.get(key);
    if (region) return { type: 'region', code: region };

    return null;
  }

  private async saveEnrichment(
    result: { success: true; jobId: string; etab: SireneEtablissement; name: string },
    onEnriched?: OnEnriched,
  ) {
    const { jobId, etab, name } = result;

    const establishment = await this.prisma.establishment.upsert({
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

    onEnriched?.(jobId, establishment);
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
          !isNaN(parseFloat(e.latitude)) &&
          !!e.longitude &&
          e.longitude !== '[NON-DIFFUSIBLE]' &&
          !isNaN(parseFloat(e.longitude)),
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
