// integration test — requires network
import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printJobs, runScraper, TEST_LOCATION, TEST_QUERY } from './helpers';
import { JTMS } from '../../src/scraper/boards/jtms.config';

describe('JobsThatMakeSense scraper (live)', () => {
  jest.setTimeout(180_000);

  it.skip('returns jobs for a basic search', async () => {
    const jobs = await runScraper(JTMS, JobSource.JTMS, {
      query: TEST_QUERY,
      location: TEST_LOCATION,
      limit: 5,
    });

    printJobs('JTMS', jobs);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) assertValidJob(job, JobSource.JTMS);
  });
});
