import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printStats, runScraperFull, TEST_LOCATION, TEST_QUERY } from './helpers';
import { JTMS } from '../../src/scraper/boards/jtms.config';

describe('JobsThatMakeSense scraper (live)', () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const params = { query: TEST_QUERY, location: TEST_LOCATION };
    const stats = await runScraperFull(JTMS, JobSource.JTMS, { ...params, limit: 5 });

    printStats('JTMS', stats, params);
    expect(stats.jobs.length).toBeGreaterThan(0);
    for (const job of stats.jobs) assertValidJob(job, JobSource.JTMS);
  });
});
