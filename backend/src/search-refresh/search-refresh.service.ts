import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperService } from '../scraper/scraper.service';

/**
 * Periodically re-scrapes each saved search so `newResultsCount` and the
 * daily alert email stay fresh even for users who don't manually search.
 *
 * Guarantees:
 *  - a single run at a time (re-entrancy guard) — long runs simply skip the
 *    next scheduled tick;
 *  - dedup: two saved searches with the same `(query, location)` trigger one
 *    scrape per run;
 *  - per-search hard timeout (`PER_SEARCH_TIMEOUT_MS`) — a stuck scraper never
 *    blocks the whole run;
 *  - capped total: at most `MAX_SEARCHES_PER_RUN` distinct pairs per tick.
 */
@Injectable()
export class SearchRefreshService {
  private readonly logger = new Logger(SearchRefreshService.name);
  private isRunning = false;

  private static readonly PER_SEARCH_TIMEOUT_MS = 2 * 60 * 1000; // 2 min
  private static readonly MAX_SEARCHES_PER_RUN = 20;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scraper: ScraperService,
  ) {}

  @Cron(process.env.SEARCH_REFRESH_CRON ?? '0 */6 * * *')
  async refreshAll(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Previous refresh still running - skipping this tick');
      return;
    }
    this.isRunning = true;
    const startedAt = Date.now();

    try {
      const searches = await this.prisma.savedSearch.findMany();
      if (searches.length === 0) {
        this.logger.log('No saved searches - nothing to refresh');
        return;
      }

      // Dedup by (query, location) - keep the first search of each pair
      const byKey = new Map<
        string,
        { query: string; location: string; ids: string[] }
      >();
      for (const s of searches) {
        const key = `${s.query.toLowerCase()} ${s.location.toLowerCase()}`;
        const existing = byKey.get(key);
        if (existing) existing.ids.push(s.id);
        else
          byKey.set(key, { query: s.query, location: s.location, ids: [s.id] });
      }

      const pairs = Array.from(byKey.values());
      if (pairs.length > SearchRefreshService.MAX_SEARCHES_PER_RUN) {
        this.logger.warn(
          `Refresh capped at ${SearchRefreshService.MAX_SEARCHES_PER_RUN} pairs (found ${pairs.length})`,
        );
      }
      const runList = pairs.slice(0, SearchRefreshService.MAX_SEARCHES_PER_RUN);

      this.logger.log(
        `Refreshing ${runList.length} unique saved search pair(s) (${searches.length} total searches)`,
      );

      for (const pair of runList) {
        await this.refreshOne(pair);
      }

      const elapsedS = Math.round((Date.now() - startedAt) / 1000);
      this.logger.log(
        `Refresh cycle complete in ${elapsedS}s (${runList.length} pair(s))`,
      );
    } catch (e) {
      this.logger.error(
        `Refresh cycle failed: ${(e as Error).message}`,
        (e as Error).stack,
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async refreshOne(pair: {
    query: string;
    location: string;
    ids: string[];
  }): Promise<void> {
    const label = `q="${pair.query}" loc="${pair.location}"`;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      SearchRefreshService.PER_SEARCH_TIMEOUT_MS,
    );

    const start = Date.now();
    this.logger.log(`> Scraping ${label}`);
    try {
      const { total } = await this.scraper.scrapeAllBoards(
        pair.query,
        pair.location,
        controller.signal,
      );
      const elapsedS = Math.round((Date.now() - start) / 1000);
      const suffix = controller.signal.aborted ? ' (TIMEOUT)' : '';
      this.logger.log(
        `< Scraped ${label} in ${elapsedS}s - ${total} enriched job(s)${suffix}`,
      );
    } catch (e) {
      this.logger.warn(`x Scrape failed for ${label}: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    // Mark all matching searches as checked, even if the scrape failed -
    // the check itself happened; count queries will still work.
    await this.prisma.savedSearch.updateMany({
      where: { id: { in: pair.ids } },
      data: { lastCheckedAt: new Date() },
    });
  }
}
