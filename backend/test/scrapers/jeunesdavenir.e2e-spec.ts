import { JEUNESDAVENIR } from '../../src/scraper/boards/jeunesdavenir.config';
import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printJobs, runScraper } from './helpers';

describe("Jeunes d'Avenirs scraper (live)", () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const jobs = await runScraper(JEUNESDAVENIR, JobSource.JEUNESDAVENIR, {
      query: 'developpeur',
      location: 'Lyon',
      limit: 5,
    });

    printJobs(jobs);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) assertValidJob(job, JobSource.JEUNESDAVENIR);
  });
});
