import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printJobs, runScraper } from './helpers';
import { JTMS } from '../../src/scraper/boards/jtms.config';

describe('JobsThatMakeSense scraper (live)', () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const jobs = await runScraper(JTMS, JobSource.JTMS, {
      query: 'developpeur',
      location: 'Lyon, France',
      limit: 5,
    });

    printJobs(jobs);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) assertValidJob(job, JobSource.JTMS);
  });
});
