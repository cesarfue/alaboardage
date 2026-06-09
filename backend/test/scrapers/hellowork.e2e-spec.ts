import { HELLOWORK } from '../../src/scraper/boards/hellowork.config';
import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printStats, runScraperFull, TEST_LOCATION, TEST_QUERY } from './helpers';

// Run with: npm run test:e2e -- hellowork
describe('Hellowork scraper (live)', () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const params = { query: TEST_QUERY, location: TEST_LOCATION };
    const stats = await runScraperFull(HELLOWORK, JobSource.HELLOWORK, { ...params, limit: 5 });

    printStats('Hellowork', stats, params);
    expect(stats.jobs.length).toBeGreaterThan(0);
    for (const job of stats.jobs) assertValidJob(job, JobSource.HELLOWORK);
  });
});
