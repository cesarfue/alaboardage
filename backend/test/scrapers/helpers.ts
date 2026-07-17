import 'reflect-metadata';
import { performance } from 'node:perf_hooks';
import { chromium, type Browser } from 'playwright';
import { BoardScraper } from '../../src/scraper/board.scraper';
import { WTTJScraper } from '../../src/scraper/wttj.scraper';
import type { BoardConfig } from '../../src/scraper/types';
import type { ScrapeRequestDto } from '../../src/scraper/dto/scrape-request.dto';
import type { CreateJobDto } from '../../src/jobs/dto/create-job.dto';
import { JobSource } from '../../generated/prisma/enums';
import type { Job } from '../../generated/prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JobsService } from '../../src/jobs/jobs.service';
import { EnrichmentService } from '../../src/enrichment/enrichment.service';

export const TEST_QUERY = process.env.QUERY ?? 'developpeur';
export const TEST_LOCATION = process.env.LOCATION ?? 'Lyon, France';

// Higher default limit for regression baselines: we want a realistic sample,
// not the 5-job default used by ad-hoc debug specs.
export const TEST_LIMIT = Number(process.env.LIMIT ?? 30);

export interface ScraperStats {
  board: string;
  query: string;
  location: string;
  scraperDurationMs: number;
  enrichmentDurationMs: number;
  enrichmentDurationPerJobMs: number;
  jobsScraped: number;
  jobsInserted: number;
  newJobs: number;
  enrichedCount: number;
  enrichmentRatio: number;
  jobs: CreateJobDto[];
  insertedJobs: Job[];
  missingCompanies: { company: string; location: string }[];
  error?: string;
}

export interface FullScrapeServices {
  prisma: PrismaService;
  jobs: JobsService;
  enrichment: EnrichmentService;
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: process.env.HEADED !== '1',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

export async function runScraper(
  config: BoardConfig,
  source: JobSource,
  params: Partial<ScrapeRequestDto> = {},
): Promise<CreateJobDto[]> {
  const dto: ScrapeRequestDto = {
    source,
    query: params.query ?? TEST_QUERY,
    location: params.location ?? TEST_LOCATION,
    limit: params.limit ?? 5,
    offset: params.offset ?? 1,
    singlePage: params.singlePage ?? true,
  };

  const collected: CreateJobDto[] = [];
  const onJob = (job: CreateJobDto) => {
    collected.push(job);
    return Promise.resolve();
  };

  if (source === JobSource.WTTJ) {
    const scraper = new WTTJScraper(dto, source);
    await scraper.search(onJob);
    return collected;
  }

  const browser = await launchBrowser();
  try {
    const scraper = new BoardScraper(browser, config, dto, source);
    await scraper.search(onJob);
    return collected;
  } finally {
    await browser.close();
  }
}

/**
 * Full scrape → DB upsert → enrichment pipeline used by the regression suite.
 *
 * Returns per-board metrics: timings, counts, sample jobs, missing companies.
 * Never throws — a scraper failure is captured in `stats.error` and the run
 * continues with zeroed counts so we still emit a baseline JSON. This lets us
 * detect "board went to zero" as a regression signal via git diff.
 */
export async function runScraperFull(
  services: FullScrapeServices,
  config: BoardConfig | null,
  source: JobSource,
  params: Partial<ScrapeRequestDto> = {},
): Promise<ScraperStats> {
  const { prisma, jobs: jobsService, enrichment } = services;
  const query = params.query ?? TEST_QUERY;
  const location = params.location ?? TEST_LOCATION;
  const limit = params.limit ?? TEST_LIMIT;

  const stats: ScraperStats = {
    board: source,
    query,
    location,
    scraperDurationMs: 0,
    enrichmentDurationMs: 0,
    enrichmentDurationPerJobMs: 0,
    jobsScraped: 0,
    jobsInserted: 0,
    newJobs: 0,
    enrichedCount: 0,
    enrichmentRatio: 0,
    jobs: [],
    insertedJobs: [],
    missingCompanies: [],
  };

  // 1. Scrape
  const scrapeStart = performance.now();
  let scrapedJobs: CreateJobDto[] = [];
  try {
    scrapedJobs = await runScraper(config as BoardConfig, source, {
      query,
      location,
      limit,
      offset: params.offset ?? 1,
      singlePage: params.singlePage ?? true,
    });
  } catch (e) {
    stats.error = (e as Error).message;
  }
  stats.scraperDurationMs = Math.round(performance.now() - scrapeStart);
  stats.jobs = scrapedJobs;
  stats.jobsScraped = scrapedJobs.length;

  if (scrapedJobs.length === 0) {
    return stats;
  }

  // 2. Upsert in DB + 3. Enrichment — wrap both in a try/catch so a DB
  //    failure still yields a baseline JSON (with `error` set) instead of
  //    bubbling up and aborting the whole suite.
  try {
    const externalIds = scrapedJobs.map((j) => j.externalId);
    const existingIds = new Set(
      (
        await prisma.job.findMany({
          where: { source, externalId: { in: externalIds } },
          select: { externalId: true },
        })
      ).map((j: { externalId: string }) => j.externalId),
    );

    const inserted = await jobsService.upsertMany(scrapedJobs);
    stats.insertedJobs = inserted;
    stats.jobsInserted = inserted.length;
    stats.newJobs = scrapedJobs.filter(
      (j) => !existingIds.has(j.externalId),
    ).length;

    // Reset establishmentId to force real enrichment work on each run —
    // otherwise re-runs report 0 durations for already-enriched jobs.
    const jobIds = inserted.map((j) => j.id);
    await prisma.job.updateMany({
      where: { id: { in: jobIds } },
      data: { establishmentId: null },
    });

    const enrichStart = performance.now();
    const enrichedJobIds = new Set<string>();
    await enrichment.enrichJobs(
      inserted.map((j) => ({
        id: j.id,
        company: j.company,
        location: j.location,
      })),
      (jobId: string) => enrichedJobIds.add(jobId),
      source,
    );
    stats.enrichmentDurationMs = Math.round(performance.now() - enrichStart);
    stats.enrichedCount = enrichedJobIds.size;
    stats.enrichmentRatio =
      inserted.length > 0
        ? Number((enrichedJobIds.size / inserted.length).toFixed(3))
        : 0;
    stats.enrichmentDurationPerJobMs =
      inserted.length > 0
        ? Math.round(stats.enrichmentDurationMs / inserted.length)
        : 0;

    stats.missingCompanies = inserted
      .filter((j) => !enrichedJobIds.has(j.id))
      .map((j) => ({ company: j.company, location: j.location }));
  } catch (e) {
    stats.error = `db/enrichment: ${(e as Error).message}`;
  }

  return stats;
}

/**
 * Manually instantiate the services `runScraperFull` needs. We avoid the
 * NestJS TestingModule here — it drags in the full application graph
 * (auth, scoring, mail, cron) which isn't needed for scraper baselines.
 */
export async function bootServices(): Promise<FullScrapeServices> {
  const prisma = new PrismaService();
  await prisma.onModuleInit();
  const jobs = new JobsService(prisma);
  const enrichment = new EnrichmentService(prisma);
  enrichment.onModuleInit();
  return { prisma, jobs, enrichment };
}

export async function shutdownServices(services: FullScrapeServices) {
  await services.prisma.onModuleDestroy();
}

export function assertValidJob(job: CreateJobDto, expectedSource: JobSource) {
  expect(job.source).toBe(expectedSource);
  expect(job.externalId).toBeTruthy();
  expect(job.title).toBeTruthy();
  expect(job.company).toBeTruthy();
  expect(job.url).toMatch(/^https?:\/\//);
}

export function printJobs(label: string, jobs: CreateJobDto[]) {
  console.log(`\n=== ${label} — ${jobs.length} job(s) ===`);
  for (const job of jobs) {
    const date =
      job.datePosted instanceof Date
        ? job.datePosted.toISOString().slice(0, 10)
        : String(job.datePosted);
    const descLen = job.description?.length ?? 0;
    const flags = [job.location ? '' : 'NO_LOC', descLen > 0 ? '' : 'NO_DESC']
      .filter(Boolean)
      .join(' ');
    console.log(
      `  [${flags || 'OK'}] ${job.title} | ${job.company} | ${job.location || '(empty)'} | ${date} | desc:${descLen}c`,
    );
  }
}

/**
 * Console-log a one-line summary per board — printed inline after each run
 * so tail-following logs shows progress.
 */
export function printStats(stats: ScraperStats) {
  const ratioPct = Math.round(stats.enrichmentRatio * 100);
  const scrapeSec = (stats.scraperDurationMs / 1000).toFixed(1);
  const enrichSec = (stats.enrichmentDurationMs / 1000).toFixed(1);
  const zeroWarn = stats.jobsScraped === 0 ? '  [WARNING] zero results' : '';
  const errWarn = stats.error ? `  [ERROR] ${stats.error}` : '';
  const pad = stats.board.padEnd(15);
  console.warn(
    `${pad}${String(stats.jobsScraped).padStart(3)} jobs / ${scrapeSec}s scrape / ${stats.enrichedCount}/${stats.jobsInserted} enriched (${ratioPct}%) / ${enrichSec}s enrichment${zeroWarn}${errWarn}`,
  );
}
