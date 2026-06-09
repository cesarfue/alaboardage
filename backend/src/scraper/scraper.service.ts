import { Injectable, Logger } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { chromium } from 'playwright';
import { Observable } from 'rxjs';
import { JobsService } from '../jobs/jobs.service';
import { BoardScraper } from './board.scraper';
import { WTTJScraper } from './wttj.scraper';
import { GLASSDOOR } from './boards/glassdoor.config';
import { HELLOWORK } from './boards/hellowork.config';
import { JEUNESDAVENIR } from './boards/jeunesdavenir.config';
import { JTMS } from './boards/jtms.config';
import { LINKEDIN } from './boards/linkedin.config';
import type { BoardConfig } from './types';
import { JobSource } from '../../generated/prisma/enums';
import type { Job } from '../../generated/prisma/client';
import { ScrapeRequestDto } from './dto/scrape-request.dto';
import { FindJobsDto } from '../jobs/dto/find-jobs-query.dto';
import { EnrichmentService } from '../enrichment/enrichment.service';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  scrapeAllBoardsStream(dto: FindJobsDto): Observable<MessageEvent> {
    return new Observable((observer) => {
      const start = Date.now();
      const sources = Object.values(JobSource);
      let completed = 0;
      let total = 0;

      for (const source of sources) {
        this.scrape({
          source,
          query: dto.query ?? '',
          location: dto.location ?? '',
          limit: 150,
          offset: 1,
          singlePage: false,
        })
          .then((jobs) => {
            total += jobs.length;
            for (const job of jobs) {
              observer.next({
                data: { type: 'job', job: { ...job, establishment: null } },
              });
            }
          })
          .catch((e: Error) => {
            this.logger.error(`Failed to scrape ${source}: ${e.message}`);
          })
          .finally(() => {
            completed++;
            if (completed === sources.length) {
              observer.next({
                data: { type: 'done', total, durationMs: Date.now() - start },
              });
              observer.complete();
            }
          });
      }
    });
  }

  private async scrape(dto: ScrapeRequestDto): Promise<Job[]> {
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
      const dtoJobs = await scraper.search();
      this.logger.log(`Scraped ${dtoJobs.length} jobs from ${config.name}`);
      if (dtoJobs.length === 0) return [];
      const saved = await this.jobsService.upsertMany(dtoJobs);
      // this.enrichmentService.enrichJobs(saved).catch((e: Error) =>
      //   this.logger.error(`Enrichment failed for ${dto.source}: ${e.message}`),
      // );
      return saved;
    } finally {
      await browser.close();
    }
  }

  private async scrapeWTTJ(dto: ScrapeRequestDto): Promise<Job[]> {
    this.logger.log(
      `Scraping WTTJ (Algolia) q="${dto.query}" loc="${dto.location}" limit=${dto.limit}`,
    );
    const scraper = new WTTJScraper(dto, dto.source);
    const dtoJobs = await scraper.search();
    this.logger.log(`Scraped ${dtoJobs.length} jobs from WTTJ`);
    if (dtoJobs.length === 0) return [];
    const saved = await this.jobsService.upsertMany(dtoJobs);
    // this.enrichmentService
    //   .enrichJobs(saved)
    //   .catch((e: Error) =>
    //     this.logger.error(`Enrichment failed for WTTJ: ${e.message}`),
    //   );
    return saved;
  }

  private configFor(source: JobSource): BoardConfig {
    switch (source) {
      case JobSource.GLASSDOOR:
        return GLASSDOOR;
      case JobSource.HELLOWORK:
        return HELLOWORK;
      case JobSource.JEUNESDAVENIR:
        return JEUNESDAVENIR;
      case JobSource.JTMS:
        return JTMS;
      case JobSource.LINKEDIN:
        return LINKEDIN;
      default:
        throw new Error(`No BoardConfig for source: ${source}`);
    }
  }
}
