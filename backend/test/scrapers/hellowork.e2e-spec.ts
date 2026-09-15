// integration test — requires network
import { HELLOWORK } from '../../src/scraper/boards/hellowork.config';
import { JobSource } from '../../generated/prisma/enums';
import {
  assertValidJob,
  printJobs,
  runScraper,
  TEST_LOCATION,
  TEST_QUERY,
} from './helpers';

// Run with: npm run test:e2e -- --testPathPatterns=hellowork
describe('Hellowork scraper (live)', () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const jobs = await runScraper(HELLOWORK, JobSource.HELLOWORK, {
      query: TEST_QUERY,
      location: TEST_LOCATION,
      limit: 5,
    });

    printJobs('Hellowork', jobs);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) assertValidJob(job, JobSource.HELLOWORK);
  });
});
