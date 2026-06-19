import 'reflect-metadata';
import { chromium, type Browser } from 'playwright';
import { BoardScraper } from '../../src/scraper/board.scraper';
import { WTTJScraper } from '../../src/scraper/wttj.scraper';
import type { BoardConfig } from '../../src/scraper/types';
import type { ScrapeRequestDto } from '../../src/scraper/dto/scrape-request.dto';
import type { CreateJobDto } from '../../src/jobs/dto/create-job.dto';
import { JobSource } from '../../generated/prisma/enums';

export const TEST_QUERY = process.env.QUERY ?? 'developpeur';
export const TEST_LOCATION = process.env.LOCATION ?? 'Lyon, France';

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

  if (source === JobSource.WTTJ) {
    const scraper = new WTTJScraper(dto, source);
    return scraper.search();
  }

  const browser = await launchBrowser();
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

export function printJobs(label: string, jobs: CreateJobDto[]) {
  console.log(`\n=== ${label} — ${jobs.length} job(s) ===`);
  for (const job of jobs) {
    const date =
      job.datePosted instanceof Date
        ? job.datePosted.toISOString().slice(0, 10)
        : String(job.datePosted);
    const descLen = job.description?.length ?? 0;
    const flags = [
      job.location ? '' : 'NO_LOC',
      descLen > 0 ? '' : 'NO_DESC',
      date ? '' : 'NO_DATE',
    ]
      .filter(Boolean)
      .join(' ');
    console.log(
      `  [${flags || 'OK'}] ${job.title} | ${job.company} | ${job.location || '(empty)'} | ${date} | desc:${descLen}c`,
    );
  }
}
