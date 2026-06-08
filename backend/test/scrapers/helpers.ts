import 'reflect-metadata';
import { chromium, type Browser } from 'playwright';
import { BoardScraper } from '../../src/scraper/board.scraper';
import { WTTJScraper } from '../../src/scraper/wttj.scraper';
import type { BoardConfig } from '../../src/scraper/types';
import type { ScrapeRequestDto } from '../../src/scraper/dto/scrape-request.dto';
import type { CreateJobDto } from '../../src/jobs/dto/create-job.dto';
import { JobSource } from '../../generated/prisma/enums';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { JobsService } from '../../src/jobs/jobs.service';
import { EnrichmentService } from '../../src/enrichment/enrichment.service';

export const TEST_QUERY = process.env.QUERY ?? 'developpeur';
export const TEST_LOCATION = process.env.LOCATION ?? 'Lyon, France';

export interface ScraperStats {
  jobs: CreateJobDto[];
  dbCount: number;
  newCount: number;
  enrichedCount: number;
  missing: Array<{ company: string; location: string }>;
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: process.env.HEADED !== '1',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

export const perf = (() => {
  let t = 0;
  let stage = 1;
  let id = 0;

  return () => {
    if (stage == 1) {
      t = performance.now();
      stage = 2;
    } else {
      console.log(`t${id}: ${(performance.now() - t).toFixed(0)}ms`);
      stage = 1;
      id++;
    }
  };
})();

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

  if (source === JobSource.WTTJ) {
    perf();
    perf();
    const scraper = new WTTJScraper(dto, source);
    return scraper.search();
  }

  perf();
  const browser = await launchBrowser();
  perf();
  try {
    const scraper = new BoardScraper(browser, config, dto, source);
    return await scraper.search();
  } finally {
    await browser.close();
  }
}

export async function runScraperFull(
  config: BoardConfig,
  source: JobSource,
  params: Partial<ScrapeRequestDto> = {},
): Promise<ScraperStats> {
  const jobs = await runScraper(config, source, params);

  const url = process.env.DATABASE_URL ?? 'file:./dev.db';
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
  });
  await prisma.$connect();

  try {
    const jobsService = new JobsService(prisma as any);
    const enrichmentService = new EnrichmentService(prisma as any);

    const countBefore = await prisma.job.count({ where: { source } });
    const saved = await jobsService.upsertMany(jobs);
    const countAfter = await prisma.job.count({ where: { source } });

    await enrichmentService.enrichJobs(
      saved.map((j) => ({
        id: j.id,
        company: j.company,
        location: j.location,
      })),
    );

    const savedWithEstab = await prisma.job.findMany({
      where: { id: { in: saved.map((j) => j.id) } },
      include: { establishment: true },
    });

    const enrichedCount = savedWithEstab.filter((j) => j.establishment).length;
    const missing = savedWithEstab
      .filter((j) => !j.establishment)
      .map((j) => ({ company: j.company, location: j.location }));

    return {
      jobs,
      dbCount: saved.length,
      newCount: countAfter - countBefore,
      enrichedCount,
      missing,
    };
  } finally {
    await prisma.$disconnect();
  }
}

export function printStats(
  label: string,
  stats: ScraperStats,
  params: { query: string; location: string },
) {
  console.log(`\n=== ${label} — "${params.query}" / "${params.location}" ===`);
  console.log(`Scraper:    ${stats.jobs.length} jobs`);
  console.log(`DB:         ${stats.dbCount} upserted (${stats.newCount} new)`);
  console.log(`Enrichment: ${stats.enrichedCount}/${stats.dbCount} enriched`);
  if (stats.missing.length > 0) {
    console.log(`Not found:`);
    for (const m of stats.missing) {
      console.log(`  - ${m.company} (${m.location})`);
    }
  }
}

export function assertValidJob(job: CreateJobDto, expectedSource: JobSource) {
  expect(job.source).toBe(expectedSource);
  expect(job.externalId).toBeTruthy();
  expect(job.title).toBeTruthy();
  expect(job.company).toBeTruthy();
  expect(job.url).toMatch(/^https?:\/\//);
}

export function printJobs(jobs: CreateJobDto[]) {
  console.log(`\nFound ${jobs.length} jobs`);
  for (const job of jobs) {
    console.log(
      `  - ${job.title} | ${job.company} | ${job.location} | ${job.datePosted.toISOString?.().slice(0, 10) ?? job.datePosted}`,
    );
  }
}
