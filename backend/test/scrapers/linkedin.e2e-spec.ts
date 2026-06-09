import { LINKEDIN } from '../../src/scraper/boards/linkedin.config';
import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printStats, runScraperFull, TEST_LOCATION, TEST_QUERY } from './helpers';

describe('LinkedIn scraper (live)', () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const params = { query: TEST_QUERY, location: TEST_LOCATION };
    const stats = await runScraperFull(LINKEDIN, JobSource.LINKEDIN, { ...params, limit: 5 });

    printStats('LinkedIn', stats, params);
    expect(stats.jobs.length).toBeGreaterThan(0);
    for (const job of stats.jobs) assertValidJob(job, JobSource.LINKEDIN);
  });
});
