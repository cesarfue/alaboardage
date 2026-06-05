import { chromium, type Browser } from 'playwright';
import { BoardScraper } from '../../src/scraper/board.scraper';
import { WTTJScraper } from '../../src/scraper/wttj.scraper';
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
    query: params.query ?? 'developpeur',
    location: params.location ?? 'Lyon, France',
    limit: params.limit ?? 5,
    offset: params.offset ?? 1,
    singlePage: params.singlePage ?? true,
  };

  if (source === JobSource.WTTJ) {
    perf();
    perf(); // keep timing slots consistent
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
