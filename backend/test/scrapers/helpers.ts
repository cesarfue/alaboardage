import { chromium, type Browser } from 'playwright';
import { BoardScraper } from '../../src/scraper/board.scraper';
import type { BoardConfig } from '../../src/scraper/types';
import type { ScrapeRequestDto } from '../../src/scraper/dto/scrape-request.dto';
import type { CreateJobDto } from '../../src/jobs/dto/create-job.dto';
import { JobSource } from '../../generated/prisma/enums';

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
  const browser = await launchBrowser();
  try {
    const scraper = new BoardScraper(
      browser,
      config,
      {
        source,
        query: params.query ?? 'developpeur',
        location: params.location ?? 'Lyon, France',
        limit: params.limit ?? 5,
        offset: params.offset ?? 1,
        singlePage: params.singlePage ?? true,
      },
      source,
    );
    return await scraper.search();
  } finally {
    await browser.close();
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
