import { load, type CheerioAPI } from 'cheerio';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { BoardConfig, Rule } from './types';
import type { ScrapeRequestDto } from './dto/scrape-request.dto';
import type { CreateJobDto } from '../jobs/dto/create-job.dto';
import type { KnownJob } from '../jobs/jobs.service';
import { parseDate } from './transforms';

const FRESHNESS_MS = 14 * 24 * 60 * 60 * 1000;

export class BoardScraper {
  constructor(
    private readonly browser: Browser,
    private readonly config: BoardConfig,
    private readonly params: ScrapeRequestDto,
    private readonly source: CreateJobDto['source'],
    private readonly signal?: AbortSignal,
    private readonly findKnown: (
      externalIds: string[],
    ) => Promise<Map<string, KnownJob>> = () =>
      Promise.resolve(new Map<string, KnownJob>()),
  ) {}

  async search(onJob: (job: CreateJobDto) => Promise<void>): Promise<void> {
    const context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const descriptionContext = this.config.descriptionFromCard
      ? null
      : await this.browser.newContext({
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        });
    const page = await context.newPage();
    let offset = this.params.offset;
    let actionsTaken = false;
    let emitted = 0;

    try {
      while (emitted < this.params.limit) {
        if (this.signal?.aborted) break;

        // Randomised delay between pages to reduce ban risk.
        // Skipped on the first request; higher floor for boards that flag
        // rapid sequential requests (configured via pageDelayMs).
        if (offset > this.params.offset) {
          const floor = this.config.pageDelayMs ?? 1000;
          await this.sleep(floor + Math.random() * 2000);
          // Re-check abort after sleeping — the signal may have fired mid-sleep.
          if (this.signal?.aborted) break;
        }

        const boardUrl = this.buildBoardUrl(offset);
        await page.goto(boardUrl, { waitUntil: 'domcontentloaded' });

        if (!actionsTaken && this.config.boardPageAction) {
          await this.config.boardPageAction(page);
          actionsTaken = true;
        }

        // Client-side boards (LinkedIn, JTMS, Glassdoor) render their cards
        // after domcontentloaded, so reading the DOM right away yields nothing.
        // Wait for a card to appear (and for any in-flight navigation to settle)
        // before reading. Timing out just means no results on this page.
        await page
          .waitForSelector(this.config.selectors.card.selects, {
            timeout: 15000,
          })
          .catch(() => {});

        const html = await this.readContent(page);
        const cards = this.extractCards(html);
        if (cards.length === 0) break;

        const partialJobs = cards
          .map((cardHtml) => this.parseCard(cardHtml))
          .filter((j) => j !== null)
          .slice(0, this.params.limit - emitted);

        if (this.config.descriptionFromCard) {
          // Description already extracted from card — skip detail page fetches.
          for (const j of partialJobs) {
            if (this.signal?.aborted) break;
            await onJob(j as CreateJobDto);
            emitted++;
          }
        } else {
          const known = await this.findKnown(
            partialJobs.map((j) => j.externalId),
          );
          const batchSize = 10;
          for (let i = 0; i < partialJobs.length; i += batchSize) {
            if (this.signal?.aborted) break;
            if (i > 0) {
              // Light delay between description-fetch batches.
              await this.sleep(300 + Math.random() * 500);
            }
            const batch = partialJobs.slice(i, i + batchSize);
            const descriptions = await Promise.all(
              batch.map((j) => {
                const existing = known.get(j.externalId);
                const isFresh =
                  existing &&
                  existing.description &&
                  Date.now() - existing.scrapedAt.getTime() < FRESHNESS_MS;
                return isFresh
                  ? Promise.resolve(existing.description)
                  : this.fetchDescription(
                      descriptionContext!,
                      this.buildJobUrl(j.externalId),
                    );
              }),
            );
            // Emit in parallel: a slow handler on one job doesn't block the
            // others in the batch. onJob is awaited so the caller can throttle.
            await Promise.all(
              batch.map((j, idx) =>
                onJob({ ...j, description: descriptions[idx] }),
              ),
            );
            emitted += batch.length;
          }
        }

        if (this.params.singlePage || this.config.singlePageOnly) break;
        offset++;
      }
    } finally {
      await context.close();
      await descriptionContext?.close();
    }
  }

  private extractCards(html: string): string[] {
    const $ = load(html);
    return $(this.config.selectors.card.selects)
      .map((_, el) => $.html(el))
      .get();
  }

  sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // page.content() throws "page is navigating" if read mid-navigation
  // (seen on LinkedIn's guest endpoint). Retry a couple of times.
  private async readContent(page: Page): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await page.content();
      } catch {
        await this.sleep(500);
      }
    }
    return '';
  }

  private parseCard(
    cardHtml: string,
  ): (Omit<CreateJobDto, 'description'> & { description?: string }) | null {
    const $card = load(cardHtml);
    const selectors = this.config.selectors;
    const externalId = this.extract($card, selectors.id);
    if (!externalId) return null;
    const url = this.buildDisplayUrl(externalId);
    const datePostedRaw = this.extract($card, selectors.datePosted);
    const datePosted = datePostedRaw ? parseDate(datePostedRaw) : new Date();

    const base = {
      externalId,
      source: this.source,
      title: this.extract($card, selectors.title).replace(/\n/g, ' '),
      company: this.extract($card, selectors.company),
      location: this.extract($card, selectors.location).replace(/\n/g, ' '),
      url,
      datePosted,
    };

    if (this.config.descriptionFromCard) {
      return {
        ...base,
        description: this.extract($card, selectors.description),
      };
    }

    return base;
  }

  private async fetchDescription(
    context: BrowserContext,
    url: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const page = await context.newPage();
      let description = '';
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const $job = load(await page.content());
        description = this.extract($job, this.config.selectors.description);
      } catch {
        description = '';
      } finally {
        await page.close();
      }
      if (description) return description;
      if (attempt === 0) await this.sleep(500);
    }
    return '';
  }

  private extract($: CheerioAPI, rule: Rule): string {
    const els = $(rule.selects).toArray();
    if (els.length === 0) return '';

    const [start, end] = rule.n
      ? [rule.n[0], Math.min(rule.n[1], els.length)]
      : [0, 1];
    const slice = els.slice(start, end);

    let values: string[];
    switch (rule.returns.kind) {
      case 'text':
        values = slice.map((el) => $(el).text().trim());
        break;
      case 'attribute': {
        const name = rule.returns.name;
        values = slice
          .map((el) => $(el).attr(name))
          .filter((v): v is string => v !== undefined);
        break;
      }
      case 'html':
        values = slice.map((el) => $.html(el));
        break;
    }

    if (rule.transforms) values = values.map(rule.transforms);
    return values.join('\n\n');
  }

  private buildBoardUrl(offset: number): string {
    const params = this.config.urlParams;
    const boardPath = this.config.locationPathTransform
      ? this.config.boardPath.replace(
          '{location}',
          this.config.locationPathTransform(this.params.location),
        )
      : this.config.boardPath;
    const url = new URL(boardPath, this.config.baseUrl + '/');
    if (params.query) url.searchParams.set(params.query, this.params.query);
    if (params.location)
      url.searchParams.set(params.location, this.params.location);
    if (params.offset) {
      const base = this.config.offsetBase ?? this.params.offset;
      const step = this.config.offsetStep ?? 1;
      const value = base + (offset - this.params.offset) * step;
      url.searchParams.set(params.offset, String(value));
    }
    return url.toString();
  }

  private buildJobUrl(jobId: string): string {
    const path = this.config.jobPath.replace('{id}', jobId);
    return new URL(path, this.config.baseUrl + '/').toString();
  }

  private buildDisplayUrl(jobId: string): string {
    const template = this.config.displayJobPath ?? this.config.jobPath;
    const path = template.replace('{id}', jobId);
    return new URL(path, this.config.baseUrl + '/').toString();
  }
}
