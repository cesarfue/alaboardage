import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CreateJobDto } from '../../src/jobs/dto/create-job.dto';
import type { ScraperStats } from './helpers';

const BASELINE_DIR = join(__dirname, 'baseline');

export interface BoardBaseline {
  board: string;
  lastRun: string;
  query: string;
  location: string;
  metrics: {
    scraperDurationMs: number;
    jobsScraped: number;
    jobsInserted: number;
    newJobs: number;
    enrichmentDurationMs: number;
    enrichmentDurationPerJobMs: number;
    enrichedCount: number;
    enrichmentRatio: number;
  };
  shape: {
    duplicateExternalIds: number;
    invalidUrls: number;
    invalidDates: number;
    missingDescriptions: number;
    missingCompanies: number;
    missingLocations: number;
    avgDescriptionLength: number;
  };
  sampleJob: {
    title: string;
    company: string;
    location: string;
    // Full URL kept for shape inspection, but stripped of query strings so a
    // re-run doesn't churn on session/tracking params.
    url: string;
    // Presence flags only — we deliberately avoid recording the exact
    // datePosted or descriptionLength because those churn between runs
    // (e.g. LinkedIn assigns scrape-time to jobs posted "1h ago").
    hasDescription: boolean;
    hasUrl: boolean;
    hasDatePosted: boolean;
  } | null;
  missingCompanies: { company: string; location: string }[];
  error?: string;
}

export interface GlobalBaseline {
  lastRun: string;
  query: string;
  location: string;
  totalScraperDurationMs: number;
  totalEnrichmentDurationMs: number;
  totalJobsScraped: number;
  totalJobsInserted: number;
  totalJobsEnriched: number;
  globalEnrichmentRatio: number;
  boardsSuccessful: number;
  boardsWithZeroResults: string[];
  boardsWithError: string[];
}

function ensureBaselineDir() {
  mkdirSync(BASELINE_DIR, { recursive: true });
}

function computeShape(jobs: CreateJobDto[]) {
  const seen = new Set<string>();
  let duplicateExternalIds = 0;
  let invalidUrls = 0;
  let invalidDates = 0;
  let missingDescriptions = 0;
  let missingCompanies = 0;
  let missingLocations = 0;
  let totalDescLen = 0;

  for (const j of jobs) {
    if (seen.has(j.externalId)) duplicateExternalIds++;
    seen.add(j.externalId);
    if (!j.url || !/^https?:\/\//.test(j.url)) invalidUrls++;
    if (!(j.datePosted instanceof Date) || Number.isNaN(j.datePosted.getTime()))
      invalidDates++;
    if (!j.description || j.description.length === 0) missingDescriptions++;
    if (!j.company || j.company.length === 0) missingCompanies++;
    if (!j.location || j.location.length === 0) missingLocations++;
    totalDescLen += j.description?.length ?? 0;
  }

  return {
    duplicateExternalIds,
    invalidUrls,
    invalidDates,
    missingDescriptions,
    missingCompanies,
    missingLocations,
    avgDescriptionLength:
      jobs.length > 0 ? Math.round(totalDescLen / jobs.length) : 0,
  };
}

function toSampleJob(jobs: CreateJobDto[]): BoardBaseline['sampleJob'] {
  if (jobs.length === 0) return null;
  const j = jobs[0];
  const hasValidDate =
    j.datePosted instanceof Date && !Number.isNaN(j.datePosted.getTime());
  // Strip query string from URL — many boards append session/tracking params
  // that vary per request (`?refId=…`, `?trk=…`).
  const cleanUrl = j.url ? j.url.split('?')[0] : j.url;
  return {
    title: j.title,
    company: j.company,
    location: j.location,
    url: cleanUrl,
    hasDescription: (j.description?.length ?? 0) > 0,
    hasUrl: !!j.url && /^https?:\/\//.test(j.url),
    hasDatePosted: hasValidDate,
  };
}

/**
 * Write baseline JSON for a single board. Deterministic ordering so that
 * git diffs stay noise-free between runs — missing companies are sorted,
 * ISO date is rounded to the day so an identical run doesn't churn the file.
 */
export function writeBaseline(stats: ScraperStats): BoardBaseline {
  ensureBaselineDir();

  const sortedMissing = [...stats.missingCompanies].sort(
    (a, b) =>
      a.company.localeCompare(b.company) ||
      a.location.localeCompare(b.location),
  );

  const baseline: BoardBaseline = {
    board: stats.board,
    lastRun: new Date().toISOString().slice(0, 10),
    query: stats.query,
    location: stats.location,
    metrics: {
      scraperDurationMs: stats.scraperDurationMs,
      jobsScraped: stats.jobsScraped,
      jobsInserted: stats.jobsInserted,
      newJobs: stats.newJobs,
      enrichmentDurationMs: stats.enrichmentDurationMs,
      enrichmentDurationPerJobMs: stats.enrichmentDurationPerJobMs,
      enrichedCount: stats.enrichedCount,
      enrichmentRatio: stats.enrichmentRatio,
    },
    shape: computeShape(stats.jobs),
    sampleJob: toSampleJob(stats.jobs),
    missingCompanies: sortedMissing,
    ...(stats.error ? { error: stats.error } : {}),
  };

  const path = join(BASELINE_DIR, `${stats.board.toLowerCase()}.json`);
  writeFileSync(path, JSON.stringify(baseline, null, 2) + '\n');
  return baseline;
}

export function writeGlobalBaseline(
  runs: ScraperStats[],
  query: string,
  location: string,
): GlobalBaseline {
  ensureBaselineDir();

  const totalScraperDurationMs = runs.reduce(
    (s, r) => s + r.scraperDurationMs,
    0,
  );
  const totalEnrichmentDurationMs = runs.reduce(
    (s, r) => s + r.enrichmentDurationMs,
    0,
  );
  const totalJobsScraped = runs.reduce((s, r) => s + r.jobsScraped, 0);
  const totalJobsInserted = runs.reduce((s, r) => s + r.jobsInserted, 0);
  const totalJobsEnriched = runs.reduce((s, r) => s + r.enrichedCount, 0);

  const global: GlobalBaseline = {
    lastRun: new Date().toISOString().slice(0, 10),
    query,
    location,
    totalScraperDurationMs,
    totalEnrichmentDurationMs,
    totalJobsScraped,
    totalJobsInserted,
    totalJobsEnriched,
    globalEnrichmentRatio:
      totalJobsInserted > 0
        ? Number((totalJobsEnriched / totalJobsInserted).toFixed(3))
        : 0,
    boardsSuccessful: runs.filter(
      (r) => r.jobsScraped > 0 && r.error === undefined,
    ).length,
    boardsWithZeroResults: runs
      .filter((r) => r.jobsScraped === 0)
      .map((r) => r.board),
    boardsWithError: runs.filter((r) => r.error).map((r) => r.board),
  };

  writeFileSync(
    join(BASELINE_DIR, '_global.json'),
    JSON.stringify(global, null, 2) + '\n',
  );
  return global;
}
