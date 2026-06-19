// integration test — requires network
import { JEUNESDAVENIR } from '../../src/scraper/boards/jeunesdavenir.config';
import { JobSource } from '../../generated/prisma/enums';
import {
  assertValidJob,
  printJobs,
  runScraper,
  TEST_LOCATION,
  TEST_QUERY,
} from './helpers';

describe("Jeunes d'Avenirs scraper (live)", () => {
  jest.setTimeout(180_000);

  it.skip('returns jobs for a basic search', async () => {
    const jobs = await runScraper(JEUNESDAVENIR, JobSource.JEUNESDAVENIR, {
      query: TEST_QUERY,
      location: TEST_LOCATION,
      limit: 5,
    });

    printJobs("Jeunes d'Avenir", jobs);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) assertValidJob(job, JobSource.JEUNESDAVENIR);
  });
});
