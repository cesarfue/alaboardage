import { WTTJ } from '../../src/scraper/boards/wttj.config';
import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printStats, runScraperFull, TEST_LOCATION, TEST_QUERY } from './helpers';

describe('WTTJ scraper (live)', () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const params = { query: TEST_QUERY, location: TEST_LOCATION };
    const stats = await runScraperFull(WTTJ, JobSource.WTTJ, { ...params, limit: 5 });

    printStats('WTTJ', stats, params);
    expect(stats.jobs.length).toBeGreaterThan(0);
    for (const job of stats.jobs) assertValidJob(job, JobSource.WTTJ);
  });
});
