// integration test — requires network
// WTTJ uses the Algolia API via WTTJScraper (not BoardScraper).
// runScraper() dispatches to WTTJScraper automatically for JobSource.WTTJ.
// See src/scraper/boards/wttj.config.ts for the deprecated HTML-scraping config.
import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printJobs, runScraper, TEST_LOCATION, TEST_QUERY } from './helpers';
import type { BoardConfig } from '../../src/scraper/types';

describe('WTTJ scraper (live)', () => {
  jest.setTimeout(180_000);

  it.skip('returns jobs for a basic search', async () => {
    // WTTJScraper does not need a BoardConfig; pass null — runScraper handles it.
    const jobs = await runScraper(null as unknown as BoardConfig, JobSource.WTTJ, {
      query: TEST_QUERY,
      location: TEST_LOCATION,
      limit: 5,
    });

    printJobs('WTTJ', jobs);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) assertValidJob(job, JobSource.WTTJ);
  });
});
