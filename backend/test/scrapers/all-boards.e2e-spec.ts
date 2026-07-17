// Non-regression suite for all scrapers.
//
// Runs each board sequentially (must be invoked with --runInBand — see the
// `test:scrapers` npm script), captures timings and counts, writes one
// baseline JSON per board plus a global aggregate. Nothing fails on
// regression — degraded metrics show up in `git diff baseline/`.

// Disable the manual mock for @prisma/adapter-pg (test/__mocks__/…) — it
// exists for unit tests that don't need a real DB. Scraper baselines DO
// need the real adapter to reach Postgres and the SIRENE tables.
jest.unmock('@prisma/adapter-pg');

import { JobSource } from '../../generated/prisma/enums';
import type { BoardConfig } from '../../src/scraper/types';
import { GLASSDOOR } from '../../src/scraper/boards/glassdoor.config';
import { HELLOWORK } from '../../src/scraper/boards/hellowork.config';
import { JEUNESDAVENIR } from '../../src/scraper/boards/jeunesdavenir.config';
import { JTMS } from '../../src/scraper/boards/jtms.config';
import { LINKEDIN } from '../../src/scraper/boards/linkedin.config';
import {
  bootServices,
  printStats,
  runScraperFull,
  shutdownServices,
  TEST_LOCATION,
  TEST_QUERY,
  type FullScrapeServices,
  type ScraperStats,
} from './helpers';
import { writeBaseline, writeGlobalBaseline } from './baseline';

interface BoardEntry {
  source: JobSource;
  config: BoardConfig | null;
  // Glassdoor's location param is ignored (static France-wide URL) — the spec
  // file historically overrode it. We keep the override here for consistency.
  locationOverride?: string;
}

const BOARDS: BoardEntry[] = [
  { source: JobSource.LINKEDIN, config: LINKEDIN },
  { source: JobSource.HELLOWORK, config: HELLOWORK },
  { source: JobSource.WTTJ, config: null },
  { source: JobSource.JTMS, config: JTMS },
  {
    source: JobSource.GLASSDOOR,
    config: GLASSDOOR,
    locationOverride: 'France',
  },
  { source: JobSource.JEUNESDAVENIR, config: JEUNESDAVENIR },
];

describe('Scraper regression suite', () => {
  // Each board can take up to ~3 min individually (LinkedIn is the slowest,
  // JTMS scroll can hang). Total suite budget = boards × per-board budget.
  jest.setTimeout(180_000);

  let services: FullScrapeServices;
  const runs: ScraperStats[] = [];

  beforeAll(async () => {
    services = await bootServices();
  });

  afterAll(async () => {
    // Global aggregate + final summary — printed even if a board threw.
    if (runs.length > 0) {
      const global = writeGlobalBaseline(runs, TEST_QUERY, TEST_LOCATION);
      const totalScrapeSec = (global.totalScraperDurationMs / 1000).toFixed(1);
      const totalEnrichSec = (global.totalEnrichmentDurationMs / 1000).toFixed(
        1,
      );
      const ratioPct = Math.round(global.globalEnrichmentRatio * 100);
      console.warn('\n=== SCRAPER REGRESSION SUITE ===');
      for (const s of runs) printStats(s);
      console.warn(
        `\nGlobal: ${global.totalJobsScraped} jobs scraped, ${global.totalJobsEnriched}/${global.totalJobsInserted} enriched (${ratioPct}%), ${totalScrapeSec}s scrape total, ${totalEnrichSec}s enrichment total`,
      );
      if (global.boardsWithZeroResults.length > 0) {
        console.warn(
          `[REGRESSION] boards returning zero results: ${global.boardsWithZeroResults.join(', ')}`,
        );
      }
      if (global.boardsWithError.length > 0) {
        console.warn(
          `[ERROR] boards that threw: ${global.boardsWithError.join(', ')}`,
        );
      }
    }
    if (services) await shutdownServices(services);
  });

  for (const board of BOARDS) {
    // Each board gets its own `it` — Jest reports pass/fail per board and
    // isolates state (a hang in one board doesn't zero out earlier ones
    // because their baseline was already written).
    it(`baseline: ${board.source}`, async () => {
      const stats = await runScraperFull(services, board.config, board.source, {
        location: board.locationOverride,
      });
      runs.push(stats);
      writeBaseline(stats);
      printStats(stats);

      // Shape assertions — warnings only (see the console.warn calls above).
      // We never fail the test on a regression, but we do assert the run
      // itself produced a valid stats object (guarding against bugs in the
      // helper rather than in the scraped data).
      expect(stats.board).toBe(board.source);
      expect(stats.scraperDurationMs).toBeGreaterThanOrEqual(0);

      if (stats.jobsScraped === 0) {
        console.warn(
          `[REGRESSION] Board ${board.source} returned 0 results (query="${stats.query}", location="${stats.location}")`,
        );
      }
      if (stats.error) {
        console.warn(`[ERROR] Board ${board.source} threw: ${stats.error}`);
      }
    });
  }
});
