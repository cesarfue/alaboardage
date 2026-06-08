import { JEUNESDAVENIR } from '../../src/scraper/boards/jeunesdavenir.config';
import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printStats, runScraperFull, TEST_LOCATION, TEST_QUERY } from './helpers';

describe("Jeunes d'Avenirs scraper (live)", () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const params = { query: TEST_QUERY, location: TEST_LOCATION };
    const stats = await runScraperFull(JEUNESDAVENIR, JobSource.JEUNESDAVENIR, { ...params, limit: 5 });

    printStats("Jeunes d'Avenir", stats, params);
    expect(stats.jobs.length).toBeGreaterThan(0);
    for (const job of stats.jobs) assertValidJob(job, JobSource.JEUNESDAVENIR);
  });
});
