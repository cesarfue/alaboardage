import { GLASSDOOR } from '../../src/scraper/boards/glassdoor.config';
import { JobSource } from '../../generated/prisma/enums';
import { assertValidJob, printJobs, runScraper } from './helpers';

// Run with: npx jest test/scrapers/glassdoor --verbose --testTimeout=180000
//
// Note: Glassdoor uses a static board URL (France-wide, developpeur query).
// The query/location params passed to runScraper are ignored for this board.
// Descriptions are short snippets (~150 chars) from the card — detail pages
// are blocked by anti-bot protection.
describe('Glassdoor scraper (live)', () => {
  jest.setTimeout(180_000);

  it('returns jobs for a basic search', async () => {
    const jobs = await runScraper(GLASSDOOR, JobSource.GLASSDOOR, {
      query: 'developpeur',
      location: 'France',
      limit: 5,
    });

    printJobs(jobs);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) assertValidJob(job, JobSource.GLASSDOOR);
  });
});
