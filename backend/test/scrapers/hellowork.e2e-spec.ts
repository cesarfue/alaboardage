import { HELLOWORK } from '../../src/scraper/boards/hellowork.config';
import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printJobs, runScraper } from './helpers';

// Original Rust config is out of date (selectors changed). Run with
// `npm run test:e2e -- hellowork` to iterate on the config.
describe('Hellowork scraper (live)', () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const jobs = await runScraper(HELLOWORK, JobSource.HELLOWORK, {
      query: 'developpeur',
      location: 'Lyon, France',
      limit: 5,
    });

    printJobs(jobs);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) assertValidJob(job, JobSource.HELLOWORK);
  });
});
