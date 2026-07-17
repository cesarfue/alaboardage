/**
 * Unit tests for BoardScraper.
 * All Playwright calls are mocked — no network access required.
 */

import type { Browser, BrowserContext, Page } from 'playwright';
import { BoardScraper } from './board.scraper';
import type { BoardConfig } from './types';
import type { ScrapeRequestDto } from './dto/scrape-request.dto';
import type { CreateJobDto } from '../jobs/dto/create-job.dto';
import { JobSource } from '../../generated/prisma/enums';

/** Collect jobs emitted through the new callback-based `search()` API. */
async function collect(scraper: BoardScraper): Promise<CreateJobDto[]> {
  const jobs: CreateJobDto[] = [];
  await scraper.search((job) => {
    jobs.push(job);
    return Promise.resolve();
  });
  return jobs;
}

// ---------------------------------------------------------------------------
// Minimal board config used across tests
// ---------------------------------------------------------------------------

const CARD_HTML = `
<div class="card" data-id="job-42">
  <h3 class="title">Senior Dev</h3>
  <span class="company">Acme Corp</span>
  <span class="location">Paris, France</span>
  <time datetime="2026-01-15"></time>
</div>
`;

const DETAIL_HTML = `
<div class="description">Full job description goes here.</div>
`;

const TEST_CONFIG: BoardConfig = {
  name: 'TestBoard',
  baseUrl: 'https://example.com',
  boardPath: '/jobs',
  jobPath: '/jobs/{id}',
  selectors: {
    card: { selects: 'div.card', returns: { kind: 'html' } },
    id: {
      selects: 'div.card',
      returns: { kind: 'attribute', name: 'data-id' },
    },
    title: { selects: 'h3.title', returns: { kind: 'text' } },
    company: { selects: 'span.company', returns: { kind: 'text' } },
    location: { selects: 'span.location', returns: { kind: 'text' } },
    description: { selects: 'div.description', returns: { kind: 'text' } },
    datePosted: {
      selects: 'time',
      returns: { kind: 'attribute', name: 'datetime' },
    },
  },
  urlParams: { query: 'q', location: 'l', offset: 'p' },
};

const BASE_PARAMS: ScrapeRequestDto = {
  source: JobSource.HELLOWORK,
  query: 'dev',
  location: 'Paris',
  limit: 5,
  offset: 1,
  singlePage: true,
};

// ---------------------------------------------------------------------------
// Playwright mock factory
// ---------------------------------------------------------------------------

function makePageMock(html: string): Partial<Page> {
  return {
    goto: jest.fn().mockResolvedValue(null),
    waitForSelector: jest.fn().mockResolvedValue(null),
    content: jest.fn().mockResolvedValue(html),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

function makeBrowserMock(
  boardHtml: string,
  detailHtml: string = DETAIL_HTML,
): Browser {
  const boardPage = makePageMock(boardHtml);
  const detailPage = makePageMock(detailHtml);

  const context: Partial<BrowserContext> = {
    newPage: jest
      .fn()
      // First call = board page, subsequent calls = detail pages
      .mockResolvedValueOnce(boardPage)
      .mockResolvedValue(detailPage),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    newContext: jest.fn().mockResolvedValue(context),
  } as unknown as Browser;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BoardScraper', () => {
  describe('search()', () => {
    it('returns parsed jobs from board page HTML', async () => {
      const browser = makeBrowserMock(CARD_HTML);
      const scraper = new BoardScraper(
        browser,
        TEST_CONFIG,
        BASE_PARAMS,
        JobSource.HELLOWORK,
      );

      const jobs = await collect(scraper);

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({
        externalId: 'job-42',
        title: 'Senior Dev',
        company: 'Acme Corp',
        location: 'Paris, France',
        url: 'https://example.com/jobs/job-42',
        source: JobSource.HELLOWORK,
      });
      expect(jobs[0].datePosted).toBeInstanceOf(Date);
    });

    it('fetches description from detail page when descriptionFromCard is false', async () => {
      const browser = makeBrowserMock(CARD_HTML, DETAIL_HTML);
      const scraper = new BoardScraper(
        browser,
        TEST_CONFIG,
        BASE_PARAMS,
        JobSource.HELLOWORK,
      );

      const jobs = await collect(scraper);

      expect(jobs[0].description).toBe('Full job description goes here.');
    });

    it('uses card description when descriptionFromCard is true', async () => {
      const cardWithDesc = `
<div class="card" data-id="job-99">
  <h3 class="title">Dev</h3>
  <span class="company">Corp</span>
  <span class="location">Lyon</span>
  <time datetime="2026-01-01"></time>
  <div class="description">Card snippet.</div>
</div>`;
      const config: BoardConfig = { ...TEST_CONFIG, descriptionFromCard: true };
      const browser = makeBrowserMock(cardWithDesc);
      const scraper = new BoardScraper(
        browser,
        config,
        BASE_PARAMS,
        JobSource.HELLOWORK,
      );

      const jobs = await collect(scraper);

      expect(jobs[0].description).toBe('Card snippet.');
      // context.newPage should have been called only once (board page, no detail fetches)
      const context = await (browser.newContext as jest.Mock).mock.results[0]
        .value;
      expect(context.newPage).toHaveBeenCalledTimes(1);
    });

    it('returns no jobs when the board page has no cards', async () => {
      const browser = makeBrowserMock('<html><body>No results</body></html>');
      const scraper = new BoardScraper(
        browser,
        TEST_CONFIG,
        BASE_PARAMS,
        JobSource.HELLOWORK,
      );

      const jobs = await collect(scraper);

      expect(jobs).toHaveLength(0);
    });

    it('respects the limit parameter', async () => {
      // 3 cards in the HTML, limit = 2
      const multiCard =
        CARD_HTML.replace('job-42', 'job-1') +
        CARD_HTML.replace('job-42', 'job-2') +
        CARD_HTML.replace('job-42', 'job-3');

      const browser = makeBrowserMock(multiCard);
      const scraper = new BoardScraper(
        browser,
        TEST_CONFIG,
        { ...BASE_PARAMS, limit: 2 },
        JobSource.HELLOWORK,
      );

      const jobs = await collect(scraper);

      expect(jobs).toHaveLength(2);
    });

    it('aborts when the AbortSignal is triggered', async () => {
      const controller = new AbortController();
      controller.abort();

      const browser = makeBrowserMock(CARD_HTML);
      const scraper = new BoardScraper(
        browser,
        TEST_CONFIG,
        BASE_PARAMS,
        JobSource.HELLOWORK,
        controller.signal,
      );

      const jobs = await collect(scraper);

      expect(jobs).toHaveLength(0);
    });

    it('skips cards with no externalId', async () => {
      // Card with no data-id attribute
      const badCard = '<div class="card"><h3 class="title">No ID</h3></div>';
      const browser = makeBrowserMock(badCard);
      const scraper = new BoardScraper(
        browser,
        TEST_CONFIG,
        BASE_PARAMS,
        JobSource.HELLOWORK,
      );

      const jobs = await collect(scraper);

      expect(jobs).toHaveLength(0);
    });

    it('enforces singlePageOnly from config even when params.singlePage is false', async () => {
      const config: BoardConfig = { ...TEST_CONFIG, singlePageOnly: true };
      const browser = makeBrowserMock(CARD_HTML);
      const scraper = new BoardScraper(
        browser,
        config,
        { ...BASE_PARAMS, singlePage: false, limit: 100 },
        JobSource.HELLOWORK,
      );

      const jobs = await collect(scraper);

      // Only 1 card in the HTML, loop should break after first page despite limit=100
      expect(jobs).toHaveLength(1);
      const context = await (browser.newContext as jest.Mock).mock.results[0]
        .value;
      // board page + 1 detail page
      expect(context.newPage).toHaveBeenCalledTimes(2);
    });
  });

  describe('URL building', () => {
    it('builds the correct board URL with query, location and offset', async () => {
      // Use descriptionFromCard to avoid detail page fetches
      const config: BoardConfig = { ...TEST_CONFIG, descriptionFromCard: true };
      // Card with desc to avoid empty results
      const card = `<div class="card" data-id="x"><h3 class="title">T</h3><span class="company">C</span><span class="location">L</span><time datetime="2026-01-01"></time><div class="description">D</div></div>`;
      const browser = makeBrowserMock(card);
      const scraper = new BoardScraper(
        browser,
        config,
        { ...BASE_PARAMS, query: 'ingenieur', location: 'Lyon', offset: 1 },
        JobSource.HELLOWORK,
      );

      await collect(scraper);

      const context = await (browser.newContext as jest.Mock).mock.results[0]
        .value;
      const page: Page = await context.newPage.mock.results[0].value;
      const gotoCall = (page.goto as jest.Mock).mock.calls[0][0] as string;

      expect(gotoCall).toContain('q=ingenieur');
      expect(gotoCall).toContain('l=Lyon');
      expect(gotoCall).toContain('p=1');
    });

    it('respects offsetBase when building paginated URLs', async () => {
      const config: BoardConfig = {
        ...TEST_CONFIG,
        descriptionFromCard: true,
        offsetBase: 0,
        singlePageOnly: false,
      };
      const card = `<div class="card" data-id="x"><h3 class="title">T</h3><span class="company">C</span><span class="location">L</span><time datetime="2026-01-01"></time><div class="description">D</div></div>`;
      // Return cards on page 1, empty on page 2 to stop the loop
      const contextMock: Partial<BrowserContext> = {
        newPage: jest.fn().mockResolvedValue(makePageMock(card)),
        close: jest.fn().mockResolvedValue(undefined),
      };
      const browserMock = {
        newContext: jest.fn().mockResolvedValue(contextMock),
      } as unknown as Browser;

      const scraper = new BoardScraper(
        browserMock,
        config,
        { ...BASE_PARAMS, singlePage: true, offset: 1 },
        JobSource.HELLOWORK,
      );

      await collect(scraper);

      const page: Page = await (contextMock.newPage as jest.Mock).mock
        .results[0].value;
      const gotoUrl = (page.goto as jest.Mock).mock.calls[0][0] as string;

      // offsetBase=0, offset param starts from 0, not 1
      expect(gotoUrl).toContain('p=0');
    });
  });
});
