import { Injectable, Logger } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { chromium } from 'playwright';
import type { Browser } from 'playwright';
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
import type { CreateJobDto } from '../jobs/dto/create-job.dto';
import { ScrapeRequestDto } from './dto/scrape-request.dto';
import { FindJobsDto } from '../jobs/dto/find-jobs-query.dto';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { ScoringService } from '../scoring/scoring.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly enrichmentService: EnrichmentService,
    private readonly scoringService: ScoringService,
    private readonly prisma: PrismaService,
  ) {}

  scrapeAllBoardsStream(
    dto: FindJobsDto,
    userId: string,
  ): Observable<MessageEvent> {
    return new Observable((observer) => {
      const controller = new AbortController();
      const { signal } = controller;
      const start = Date.now();
      let total = 0;

      // Skills are loaded once at stream start; the score is then computed
      // inline for each job so the client receives a fully scored payload.
      void this.prisma.skill
        .findMany({ where: { userId } })
        .then((skills) => {
          const sources = Object.values(JobSource);
          const tasks = sources.map((source) =>
            this.scrapeStreaming(
              {
                source,
                query: dto.query ?? '',
                location: dto.location ?? '',
                limit: 150,
                offset: 1,
                singlePage: false,
              },
              signal,
              async (dtoJob) => {
                if (signal.aborted) return;
                const job = await this.jobsService.upsert(dtoJob);
                const establishment = await this.enrichmentService.enrichJob({
                  id: job.id,
                  company: job.company,
                  location: job.location,
                });
                // Drop jobs without a resolved establishment — they never
                // reach the client. A follow-up ticket reduces the miss rate.
                if (!establishment || signal.aborted) return;
                const score = this.scoringService.scoreJob(job, skills);
                // Persist the score asynchronously; the fresh score is
                // already in the SSE payload.
                void this.scoringService
                  .computeAndSave(job, userId)
                  .catch((e: Error) =>
                    this.logger.error(
                      `computeAndSave failed for ${job.id}: ${e.message}`,
                    ),
                  );
                total++;
                observer.next({
                  data: {
                    type: 'job',
                    job: { ...job, establishment, score },
                  },
                });
              },
            ).catch((e: Error) => {
              if (!signal.aborted)
                this.logger.error(`Failed to scrape ${source}: ${e.message}`);
            }),
          );

          return Promise.all(tasks).then(() => {
            if (!signal.aborted) {
              observer.next({
                data: { type: 'done', total, durationMs: Date.now() - start },
              });
              observer.complete();
            }
          });
        })
        .catch((e: Error) => {
          if (!signal.aborted)
            this.logger.error(`Stream setup failed: ${e.message}`);
        });

      return () => {
        controller.abort();
        this.enrichmentService.cancelEnrichment();
      };
    });
  }

  private async scrapeStreaming(
    dto: ScrapeRequestDto,
    signal: AbortSignal,
    onJob: (dto: CreateJobDto) => Promise<void>,
  ): Promise<void> {
    if (dto.source === JobSource.WTTJ) {
      this.logger.log(
        `Scraping WTTJ (Algolia) q="${dto.query}" loc="${dto.location}" limit=${dto.limit}`,
      );
      const scraper = new WTTJScraper(dto, dto.source, signal);
      await scraper.search(onJob);
      return;
    }

    const config = this.configFor(dto.source);
    this.logger.log(
      `Scraping ${config.name} q="${dto.query}" loc="${dto.location}" limit=${dto.limit}`,
    );

    const browser: Browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const scraper = new BoardScraper(
        browser,
        config,
        dto,
        dto.source,
        signal,
      );
      await scraper.search(onJob);
    } finally {
      await browser.close();
    }
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
