// integration test — requires network
import { LINKEDIN } from '../../src/scraper/boards/linkedin.config';
import { JobSource } from '../../generated/prisma/enums';
import {
  assertValidJob,
  printJobs,
  runScraper,
  TEST_LOCATION,
  TEST_QUERY,
} from './helpers';

describe('LinkedIn scraper (live)', () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const jobs = await runScraper(LINKEDIN, JobSource.LINKEDIN, {
      query: TEST_QUERY,
      location: TEST_LOCATION,
      limit: 5,
    });

    printJobs('LinkedIn', jobs);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) assertValidJob(job, JobSource.LINKEDIN);
  });
});
