import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperService } from '../scraper/scraper.service';
import { criteriaOf } from '../searches/criteria';

export type RefreshState = 'idle' | 'queued' | 'running';

/**
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
  private readonly queue: string[] = [];
  private runningSearchId: string | null = null;
  private lastRunAt: number | null = null;

  private static readonly TICK_MS = 60 * 1000; // poll cadence
  private static readonly PER_SEARCH_TIMEOUT_MS = 2 * 60 * 1000; // 2 min
  private static readonly MAX_SEARCHES_PER_RUN = 40;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scraper: ScraperService,
  ) {}

  requestRefresh(searchId: string): RefreshState {
    if (this.runningSearchId === searchId) return 'running';
    if (!this.queue.includes(searchId)) this.queue.push(searchId);
    void this.drainQueue();
    return this.stateOf(searchId);
  }

  stateOf(searchId: string): RefreshState {
    if (this.runningSearchId === searchId) return 'running';
    return this.queue.includes(searchId) ? 'queued' : 'idle';
  }

  private async drainQueue(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      while (this.queue.length > 0) {
        const searchId = this.queue.shift()!;
        this.runningSearchId = searchId;
        await this.refreshSearch(searchId);
        this.runningSearchId = null;
      }
    } finally {
      this.runningSearchId = null;
      this.isRunning = false;
    }
  }

  private async refreshSearch(searchId: string): Promise<void> {
    const search = await this.prisma.savedSearch.findUnique({
      where: { id: searchId },
    });
    if (!search) return;
    const { queries, locations } = criteriaOf(search);
    for (const query of queries) {
      for (const location of locations) {
        await this.refreshOne({ query, location, ids: [searchId] });
      }
    }
  }

  @Interval(SearchRefreshService.TICK_MS)
  async tick(): Promise<void> {
    const prefs = await this.prisma.userPreference.findUnique({
      where: { id: 1 },
    });
    if (prefs && !prefs.autoScrapeEnabled) return;
    const intervalMs = (prefs?.autoScrapeIntervalMinutes ?? 360) * 60 * 1000;
    if (this.lastRunAt !== null && Date.now() - this.lastRunAt < intervalMs) {
      return;
    }
    this.lastRunAt = Date.now();
    await this.refreshAll();
  }

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

      const byKey = new Map<
        string,
        { query: string; location: string; ids: string[] }
      >();
      for (const s of searches) {
        const { queries, locations } = criteriaOf(s);
        for (const query of queries) {
          for (const location of locations) {
            const key = `${query.toLowerCase()} ${location.toLowerCase()}`;
            const existing = byKey.get(key);
            if (existing) existing.ids.push(s.id);
            else byKey.set(key, { query, location, ids: [s.id] });
          }
        }
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
