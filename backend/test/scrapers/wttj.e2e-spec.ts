import { WTTJ } from '../../src/scraper/boards/wttj.config';
import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printJobs, runScraper } from './helpers';

describe('WTTJ scraper (live)', () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const jobs = await runScraper(WTTJ, JobSource.WTTJ, {
      query: 'developpeur',
      location: 'Lyon, France',
      limit: 5,
    });

    printJobs(jobs);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) assertValidJob(job, JobSource.WTTJ);
  });
});
