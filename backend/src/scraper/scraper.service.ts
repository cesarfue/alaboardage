import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { chromium } from 'playwright';
import { JobsService } from '../jobs/jobs.service';
import { ScrapeRequestDto } from './dto/scrape-request.dto';
import { BoardScraper } from './board.scraper';
import { HELLOWORK } from './boards/hellowork.config';
import { LINKEDIN } from './boards/linkedin.config';
import type { BoardConfig } from './types';
import { JobSource } from '../../generated/prisma/enums';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private readonly jobsService: JobsService) {}

  async scrape(dto: ScrapeRequestDto) {
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

  private configFor(source: JobSource): BoardConfig {
    switch (source) {
      case JobSource.LINKEDIN:
        return LINKEDIN;
      case JobSource.HELLOWORK:
        return HELLOWORK;
      case JobSource.WTTJ:
        throw new NotImplementedException(
          `Scraper for ${source} not yet ported`,
        );
    }
  }
}
