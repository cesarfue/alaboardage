import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { Establishment } from '../../generated/prisma/client';

type OnEnriched = (jobId: string, establishment: Establishment) => void;

interface GeoData {
  communes: { n: string; d: string; r: string; p: number }[];
  regions: { n: string; code: string }[];
}

type LocationScope =
  | { type: 'departement'; code: string }
  | { type: 'region'; code: string }
  | { type: 'national' };

interface SireneRow {
  siret: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number;
  lng: number;
}

function normalize(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Strip diacritics but keep casing and punctuation. Used to work around a
 * Postgres FTS quirk: `to_tsvector('french', 'ECOLE')` yields `'ecol'`, but
 * `websearch_to_tsquery('french', '\u00c9cole')` yields `'\u00e9col'` \u2014 the two never
 * match. Stripping accents from the query side keeps the existing FTS index
 * usable and covers the vast majority of SIRENE names (~13.5M rows, only
 * ~300 contain accented characters themselves).
 */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Guard for the national fallback: only trigger when the company name is
 * specific enough that a nationwide FTS is unlikely to return a false
 * positive. A specific name has either a long-ish word (≥ 6 chars, unlikely
 * to be a random acronym) or several medium words. Bare acronyms like
 * `ENTPE` / `ESCP` don't qualify — they'd match dozens of unrelated SIRENE
 * entries that happen to include the acronym as an appended tag.
 */
function isSpecificCompanyName(name: string): boolean {
  const simplified = name.trim();
  if (simplified.length < 6) return false;
  const words = simplified.split(/\s+/);
  const hasLongWord = words.some((w) => w.length >= 6);
  const mediumWordCount = words.filter((w) => w.length >= 4).length;
  return hasLongWord || mediumWordCount >= 2;
}

@Injectable()
export class EnrichmentService implements OnModuleInit {
  private readonly logger = new Logger(EnrichmentService.name);

  private readonly communeToScope = new Map<
    string,
    { dep: string; reg: string }
  >();
  private readonly communePop = new Map<string, number>();
  private readonly regionToCode = new Map<string, string>();
  private controller: AbortController | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const path = join(process.cwd(), 'data', 'communes.json');
    try {
      const { communes, regions } = JSON.parse(
        readFileSync(path, 'utf8'),
      ) as GeoData;
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
    this.controller?.abort();
  }

  enrichJobs(
    jobs: { id: string; company: string; location: string }[],
    onEnriched?: OnEnriched,
    label = 'unknown',
  ): Promise<void> {
    this.controller?.abort();
    this.controller = new AbortController();
    return this.runEnrichJobs(jobs, this.controller.signal, onEnriched, label);
  }

  private async runEnrichJobs(
    jobs: { id: string; company: string; location: string }[],
    signal: AbortSignal | null,
    onEnriched?: OnEnriched,
    label = 'unknown',
  ) {
    const CONCURRENCY = 5;
    let enriched = 0;
    let noScope = 0;
    let noMatch = 0;

    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      if (signal?.aborted) {
        this.logger.warn(
          `[${label}] enrichment cancelled after ${enriched}/${jobs.length}`,
        );
        return;
      }
      const batch = jobs.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((job) =>
          this.resolveEstablishment(job)
            .then((result) => ({ job, result }))
            .catch((err: Error) => {
              this.logger.error(
                `[${label}] resolve error for job ${job.id}: ${err.message}`,
              );
              return {
                job,
                result: { success: false as const, reason: 'error' as const },
              };
            }),
        ),
      );

      const saves: Promise<void>[] = [];
      for (const r of results) {
        if (r.status === 'rejected') {
          noMatch++;
          continue;
        }
        const { result } = r.value;
        if (!result.success) {
          if (result.reason === 'no-scope') noScope++;
          else noMatch++;
        } else {
          saves.push(
            this.saveEnrichment(result, onEnriched)
              .then(() => undefined)
              .catch((err: Error) =>
                this.logger.error(`[${label}] save error: ${err.message}`),
              ),
          );
          enriched++;
        }
      }
      await Promise.all(saves);
    }

    const pct =
      jobs.length > 0 ? Math.round((enriched / jobs.length) * 100) : 0;
    this.logger.log(
      `[${label}] ${enriched}/${jobs.length} enriched (${pct}%)` +
        (noScope > 0 ? ` — ${noScope} no geo scope` : '') +
        (noMatch > 0 ? ` — ${noMatch} no Sirene match` : ''),
    );
  }

  async enrichJob(job: {
    id: string;
    company: string;
    location: string;
  }): Promise<Establishment | null> {
    const result = await this.resolveEstablishment(job);
    if (!result.success) return null;
    return this.saveEnrichment(result);
  }

  private async resolveEstablishment(job: {
    id: string;
    company: string;
    location: string;
  }): Promise<
    | { success: true; jobId: string; row: SireneRow }
    | { success: false; reason: 'no-scope' | 'no-match' }
  > {
    const scope = this.resolveScope(job.location);
    if (!scope) return { success: false, reason: 'no-scope' };

    const found = await this.findEstablishment(job.company, scope);
    if (!found) return { success: false, reason: 'no-match' };

    return { success: true, jobId: job.id, row: found };
  }

  /**
   * Resolve the geographic scope of a job's location string.
   *
   * The tokenizer splits on commas and spaces (dropping tokens ≤ 2 chars) and
   * tries each token against the commune / region indexes. The first match
   * wins — so `"Lyon, France"` resolves to Rhône via `Lyon`.
   *
   * Two fallbacks apply when no explicit commune/region matches:
   *   - If a `France` (or `french`) token is present but no city was found
   *     (e.g. `"France"`, `"France et 6 autres"`), return a `national` scope
   *     so the caller can attempt a nationwide match.
   *   - Otherwise return `null` — the location is probably foreign (Milan,
   *     Italy) or too degenerate to enrich safely.
   */
  private resolveScope(location: string): LocationScope | null {
    const tokens = location
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2);
    let sawFrance = false;
    for (const token of tokens) {
      const scope = this.tokenToScope(token);
      if (scope) return scope;
      const key = normalize(token);
      if (key === 'france' || key === 'french') sawFrance = true;
    }
    if (sawFrance) return { type: 'national' };
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
    result: { success: true; jobId: string; row: SireneRow },
    onEnriched?: OnEnriched,
  ): Promise<Establishment> {
    const { jobId, row } = result;

    let establishment: Establishment;
    try {
      establishment = await this.prisma.establishment.upsert({
        where: { siret: row.siret },
        create: {
          siret: row.siret,
          name: row.name,
          address: row.address ?? '',
          city: row.city ?? '',
          lat: row.lat,
          lng: row.lng,
        },
        update: {},
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'P2002') throw e;
      const found = await this.prisma.establishment.findUnique({
        where: { siret: row.siret },
      });
      if (!found) throw e;
      establishment = found;
    }

    await this.prisma.job.update({
      where: { id: jobId },
      data: { establishmentId: row.siret },
    });

    onEnriched?.(jobId, establishment);
    return establishment;
  }

  /**
   * Best-effort establishment resolution.
   *
   * 1. Query at the given scope with the raw company name (FTS then trigram).
   * 2. On miss, retry with the simplified name (`Groupe X France SAS` → `X`).
   * 3. On miss and non-national scope, widen to a national FTS-only search.
   *
   * National-scope queries — whether direct (location was `"France"`) or via
   * the widen fallback — are guarded by `isSpecificCompanyName` to avoid
   * matching random SIRENE rows on bare acronyms. Trigram is intentionally
   * NOT run at national scope (13.5M rows × similarity is slow and noisy).
   */
  private async findEstablishment(
    company: string,
    scope: LocationScope,
  ): Promise<SireneRow | null> {
    // At national scope every query must be gated — the check is applied per
    // name variant (raw + simplified) because simplification can shrink a
    // specific-looking name down to a bare acronym (`ESCP Extension` → `ESCP`).
    const canRunNational = (n: string) =>
      scope.type !== 'national' || isSpecificCompanyName(n);

    if (canRunNational(company)) {
      const row = await this.queryLocal(company, scope);
      if (row) return row;
    }

    const simplified = this.simplifyCompanyName(company);
    if (simplified !== company && canRunNational(simplified)) {
      const simplifiedRow = await this.queryLocal(simplified, scope);
      if (simplifiedRow) return simplifiedRow;
    }

    if (scope.type !== 'national' && isSpecificCompanyName(simplified)) {
      const national: LocationScope = { type: 'national' };
      const wideRow = await this.queryLocalFts(simplified, national);
      if (wideRow) return wideRow;
    }

    return null;
  }

  /**
   * Recherche le meilleur établissement dans la table SIRENE locale, restreint
   * au scope géographique. D'abord par full-text français (tokens + stemming,
   * proche du moteur de l'API), puis fallback trigramme (fautes / variantes).
   *
   * National scope skips the trigram step — on 13.5M rows the similarity
   * search is both slow and prone to false positives without a geo filter.
   */
  private async queryLocal(
    company: string,
    scope: LocationScope,
  ): Promise<SireneRow | null> {
    const fts = await this.queryLocalFts(company, scope);
    if (fts) return fts;

    if (scope.type === 'national') return null;

    const scopeFilter = this.scopeFilter(scope);
    const trgm = await this.prisma.$queryRaw<SireneRow[]>`
      SELECT siret, name, address, city, lat, lng
      FROM sirene.etablissement
      WHERE ${scopeFilter}
        AND f_unaccent(name) % f_unaccent(${company})
      ORDER BY similarity(f_unaccent(name), f_unaccent(${company})) DESC
      LIMIT 1`;
    return trgm.length > 0 ? trgm[0] : null;
  }

  /**
   * FTS-only variant — used both as the first step of `queryLocal` and as
   * the national widen-on-miss fallback in `findEstablishment`.
   *
   * `stripAccents(company)` fixes a Postgres quirk where a query built from
   * `École` (`'écol'`) never matches the tsvector `'ecol'` produced from an
   * uppercase-ASCII SIRENE name like `ECOLE`.
   */
  private async queryLocalFts(
    company: string,
    scope: LocationScope,
  ): Promise<SireneRow | null> {
    const query = stripAccents(company);
    const rows = await this.prisma.$queryRaw<SireneRow[]>`
      SELECT siret, name, address, city, lat, lng
      FROM sirene.etablissement
      WHERE ${this.scopeFilter(scope)}
        AND to_tsvector('french', name) @@ websearch_to_tsquery('french', ${query})
      ORDER BY ts_rank(
        to_tsvector('french', name),
        websearch_to_tsquery('french', ${query})
      ) DESC
      LIMIT 1`;
    return rows.length > 0 ? rows[0] : null;
  }

  private scopeFilter(scope: LocationScope) {
    if (scope.type === 'departement')
      return Prisma.sql`departement = ${scope.code}`;
    if (scope.type === 'region') return Prisma.sql`region = ${scope.code}`;
    return Prisma.sql`TRUE`;
  }

  /**
   * Trim boilerplate around the human-friendly company name so it lines up
   * with the SIRENE legal name. Applied one pass each of prefix and suffix
   * stripping, then a dash-suffix pass (`- PSL`, `- CNRS`, …) that removes
   * annexed institutional labels frequently seen on JTMS.
   */
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
      ' Extension',
      ' Digital',
      ' Corp',
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
    // Institutional dash suffixes: "Nom - PSL", "Nom - CNRS", "Nom - HEC".
    s = s.replace(/\s*-\s*(PSL|CNRS|HEC|ENS|INSA|UPMC|UPEC)\b.*$/i, '');
    return s.trim();
  }
}
