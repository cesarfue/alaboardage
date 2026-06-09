import { load, type CheerioAPI } from 'cheerio';
import type { Browser, BrowserContext } from 'playwright';
import type { BoardConfig, Rule } from './types';
import type { ScrapeRequestDto } from './dto/scrape-request.dto';
import type { CreateJobDto } from '../jobs/dto/create-job.dto';
import { parseDate } from './transforms';

export class BoardScraper {
  constructor(
    private readonly browser: Browser,
    private readonly config: BoardConfig,
    private readonly params: ScrapeRequestDto,
    private readonly source: CreateJobDto['source'],
    private readonly signal?: AbortSignal,
  ) {}

  async search(): Promise<CreateJobDto[]> {
    const context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    const jobs: CreateJobDto[] = [];
    let offset = this.params.offset;
    let actionsTaken = false;

    try {
      while (jobs.length < this.params.limit) {
        if (this.signal?.aborted) break;
        const boardUrl = this.buildBoardUrl(offset);
        await page.goto(boardUrl, { waitUntil: 'domcontentloaded' });

        if (!actionsTaken && this.config.boardPageAction) {
          await this.config.boardPageAction(page);
          actionsTaken = true;
        }

        const html = await page.content();
        const cards = this.extractCards(html);
        console.log('Found %s cards', cards.length);
        if (cards.length === 0) break;

        const partialJobs = cards
          .map((cardHtml) => this.parseCard(cardHtml))
          .filter((j) => j !== null)
          .slice(0, this.params.limit - jobs.length);

        if (this.config.descriptionFromCard) {
          // Description already extracted from card — skip detail page fetches.
          partialJobs.forEach((j) => jobs.push(j as CreateJobDto));
        } else {
          const batchSize = 10;
          for (let i = 0; i < partialJobs.length; i += batchSize) {
            const batch = partialJobs.slice(i, i + batchSize);
            const descriptions = await Promise.all(
              batch.map((j) => this.fetchDescription(context, j.url)),
            );
            batch.forEach((j, idx) =>
              jobs.push({ ...j, description: descriptions[idx] }),
            );
          }
        }

        if (this.params.singlePage) break;
        offset++;
      }
    } finally {
      await context.close();
    }

    return jobs;
  }

  private extractCards(html: string): string[] {
    const $ = load(html);
    return $(this.config.selectors.card.selects)
      .map((_, el) => $.html(el))
      .get();
  }

  sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  private parseCard(
    cardHtml: string,
  ): Omit<CreateJobDto, 'description'> & { description?: string } | null {
    const $card = load(cardHtml);
    const selectors = this.config.selectors;
    const externalId = this.extract($card, selectors.id);
    if (!externalId) return null;
    const url = this.buildJobUrl(externalId);
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
      return { ...base, description: this.extract($card, selectors.description) };
    }

    return base;
  }

  private async fetchDescription(
    context: BrowserContext,
    url: string,
  ): Promise<string> {
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const $job = load(await page.content());
      return this.extract($job, this.config.selectors.description);
    } catch {
      return '';
    } finally {
      await page.close();
    }
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
      ? this.config.boardPath.replace('{location}', this.config.locationPathTransform(this.params.location))
      : this.config.boardPath;
    const url = new URL(boardPath, this.config.baseUrl + '/');
    if (params.query) url.searchParams.set(params.query, this.params.query);
    if (params.location) url.searchParams.set(params.location, this.params.location);
    if (params.offset) url.searchParams.set(params.offset, String(offset));
    return url.toString();
  }

  private buildJobUrl(jobId: string): string {
    const path = this.config.jobPath.replace('{id}', jobId);
    return new URL(path, this.config.baseUrl + '/').toString();
  }
}
