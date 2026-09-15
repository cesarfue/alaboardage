// integration test — requires network
// Note: Glassdoor uses a static board URL (France-wide).
// The location param is ignored for this board. Pagination is not possible
// (JS-driven infinite scroll). Only 30 cards per page. Description comes
// from the card snippet — detail pages are blocked by Glassdoor's anti-bot wall.
import { GLASSDOOR } from '../../src/scraper/boards/glassdoor.config';
import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printJobs, runScraper, TEST_QUERY } from './helpers';

describe('Glassdoor scraper (live)', () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const jobs = await runScraper(GLASSDOOR, JobSource.GLASSDOOR, {
      query: TEST_QUERY,
      location: 'France',
      limit: 5,
    });

    printJobs('Glassdoor', jobs);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) assertValidJob(job, JobSource.GLASSDOOR);
  });
});
