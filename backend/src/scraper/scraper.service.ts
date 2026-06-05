import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import { JobsService } from '../jobs/jobs.service';
import { BoardScraper } from './board.scraper';
import { WTTJScraper } from './wttj.scraper';
import { HELLOWORK } from './boards/hellowork.config';
import { JTMS } from './boards/jtms.config';
import { LINKEDIN } from './boards/linkedin.config';
import type { BoardConfig } from './types';
import { JobSource } from '../../generated/prisma/enums';
import { ScrapeRequestDto } from './dto/scrape-request.dto';
import { FindJobsDto } from '../jobs/dto/find-jobs-query.dto';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private readonly jobsService: JobsService) {}

  async scrape(dto: ScrapeRequestDto) {
    if (dto.source === JobSource.WTTJ) {
      return this.scrapeWTTJ(dto);
    }

    const config = this.configFor(dto.source);
    this.logger.log(
      `Scraping ${config.name} q="${dto.query}" loc="${dto.location}" limit=${dto.limit}`,
    );

    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const scraper = new BoardScraper(browser, config, dto, dto.source);
      const jobs = await scraper.search();
      this.logger.log(`Scraped ${jobs.length} jobs from ${config.name}`);
      if (jobs.length > 0) await this.jobsService.upsertMany(jobs);
      return { source: dto.source, count: jobs.length };
    } finally {
      await browser.close();
    }
  }

  private async scrapeWTTJ(dto: ScrapeRequestDto) {
    this.logger.log(
      `Scraping WTTJ (Algolia) q="${dto.query}" loc="${dto.location}" limit=${dto.limit}`,
    );
    const scraper = new WTTJScraper(dto, dto.source);
    const jobs = await scraper.search();
    this.logger.log(`Scraped ${jobs.length} jobs from WTTJ`);
    if (jobs.length > 0) await this.jobsService.upsertMany(jobs);
    return { source: dto.source, count: jobs.length };
  }

  async scrapeAllBoards(dto: FindJobsDto) {
    const start = Date.now();

    const sources = Object.values(JobSource);
    const counts = await Promise.all(
      sources.map(async (source) => {
        try {
          const r = await this.scrape({
            source,
            query: dto.query ?? '',
            location: dto.location ?? '',
            limit: dto.limit,
            offset: 1,
            singlePage: true,
          });
          return r;
        } catch (e) {
          this.logger.error(
            `Failed to scrape ${source}: ${(e as Error).message}`,
          );
          return { source, count: 0 };
        }
      }),
    );

    const total = counts.reduce((acc, c) => acc + c.count, 0);
    return {
      counts,
      total,
      durationMs: Date.now() - start,
    };
  }

  private configFor(source: JobSource): BoardConfig {
    switch (source) {
      case JobSource.HELLOWORK:
        return HELLOWORK;
      case JobSource.JTMS:
        return JTMS;
      case JobSource.LINKEDIN:
        return LINKEDIN;
      default:
        throw new Error(`No BoardConfig for source: ${source}`);
    }
  }
}
