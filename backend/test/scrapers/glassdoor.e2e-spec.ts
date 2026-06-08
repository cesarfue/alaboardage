import { GLASSDOOR } from '../../src/scraper/boards/glassdoor.config';
import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printStats, runScraperFull, TEST_QUERY } from './helpers';

// Note: Glassdoor uses a static board URL (France-wide).
// The location param is ignored for this board; query may be used.
describe('Glassdoor scraper (live)', () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const params = { query: TEST_QUERY, location: 'France' };
    const stats = await runScraperFull(GLASSDOOR, JobSource.GLASSDOOR, { ...params, limit: 5 });

    printStats('Glassdoor', stats, params);
    expect(stats.jobs.length).toBeGreaterThan(0);
    for (const job of stats.jobs) assertValidJob(job, JobSource.GLASSDOOR);
  });
});
