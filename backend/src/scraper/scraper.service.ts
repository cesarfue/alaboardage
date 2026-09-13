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

  /**
   * Run every board scraper end-to-end without SSE. Used by the periodic
   * refresh cron: no user, no scoring, no observer — just upsert jobs and
   * enrich them. Returns the number of jobs actually persisted+enriched.
   * Respects `signal` for hard timeouts.
   */
  async scrapeAllBoards(
    query: string,
    location: string,
    signal: AbortSignal,
  ): Promise<{ total: number }> {
    const label = `cron:${Math.random().toString(36).slice(2, 8)}`;
    const start = Date.now();
    let total = 0;
    // Mirror the SSE stream's abort behaviour: also drop any in-flight
    // enrichment when the caller times out — otherwise a stuck geocoding
    // lookup keeps the cron busy after the deadline.
    const onAbort = () => {
      this.logger.warn(`[${label}] abort signal received`);
      this.enrichmentService.cancelEnrichment();
    };
    signal.addEventListener('abort', onAbort, { once: true });

    this.logger.log(`[${label}] START q="${query}" loc="${location}"`);
    try {
      const sources = Object.values(JobSource);
      await Promise.all(
        sources.map((source) =>
          this.scrapeStreaming(
            {
              source,
              query,
              location,
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
              if (!establishment || signal.aborted) return;
              total++;
            },
            label,
          ).catch((e: Error) => {
            if (!signal.aborted)
              this.logger.error(
                `[${label}] Failed to scrape ${source}: ${e.stack ?? e.message ?? String(e)}`,
              );
          }),
        ),
      );
      this.logger.log(
        `[${label}] END total=${total} durationMs=${Date.now() - start}${signal.aborted ? ' (ABORTED)' : ''}`,
      );
      return { total };
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }

  scrapeAllBoardsStream(
    dto: FindJobsDto,
    userId: string,
  ): Observable<MessageEvent> {
    return new Observable((observer) => {
      const label = `stream:${Math.random().toString(36).slice(2, 8)}`;
      const controller = new AbortController();
      const { signal } = controller;
      const start = Date.now();
      let total = 0;
      let completed = false;

      this.logger.log(
        `[${label}] START user=${userId} q="${dto.query ?? ''}" loc="${dto.location ?? ''}"`,
      );

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
                      `[${label}] computeAndSave failed for ${job.id}: ${e.message}`,
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
              label,
            ).catch((e: Error) => {
              if (!signal.aborted)
                this.logger.error(
                  `[${label}] Failed to scrape ${source}: ${e.stack ?? e.message ?? String(e)}`,
                );
            }),
          );

          return Promise.all(tasks).then(() => {
            if (!signal.aborted) {
              completed = true;
              this.logger.log(
                `[${label}] DONE total=${total} durationMs=${Date.now() - start}`,
              );
              observer.next({
                data: { type: 'done', total, durationMs: Date.now() - start },
              });
              observer.complete();
            }
          });
        })
        .catch((e: Error) => {
          if (!signal.aborted)
            this.logger.error(
              `[${label}] Stream setup failed: ${e.stack ?? e.message ?? String(e)}`,
            );
        });

      return () => {
        if (!completed) {
          this.logger.warn(
            `[${label}] TEARDOWN before completion — client disconnect or new stream (elapsed=${Date.now() - start}ms, jobsSent=${total})`,
          );
        }
        controller.abort();
        this.enrichmentService.cancelEnrichment();
      };
    });
  }

  private async scrapeStreaming(
    dto: ScrapeRequestDto,
    signal: AbortSignal,
    onJob: (dto: CreateJobDto) => Promise<void>,
    label = 'anon',
  ): Promise<void> {
    const boardStart = Date.now();
    let jobCount = 0;
    const countedOnJob = async (job: CreateJobDto) => {
      await onJob(job);
      jobCount++;
    };

    if (dto.source === JobSource.WTTJ) {
      this.logger.log(
        `[${label}] > WTTJ (Algolia) q="${dto.query}" loc="${dto.location}" limit=${dto.limit}`,
      );
      const scraper = new WTTJScraper(dto, dto.source, signal);
      try {
        await scraper.search(countedOnJob);
        this.logger.log(
          `[${label}] < WTTJ ${jobCount} jobs in ${Date.now() - boardStart}ms${signal.aborted ? ' (ABORTED)' : ''}`,
        );
      } catch (e) {
        const err = e as Error;
        this.logger.error(
          `[${label}] × WTTJ crashed after ${jobCount} jobs in ${Date.now() - boardStart}ms: ${err.stack ?? err.message ?? String(e)}`,
        );
        throw e;
      }
      return;
    }

    const config = this.configFor(dto.source);
    this.logger.log(
      `[${label}] > ${config.name} q="${dto.query}" loc="${dto.location}" limit=${dto.limit}`,
    );

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const scraper = new BoardScraper(
        browser,
        config,
        dto,
        dto.source,
        signal,
      );
      await scraper.search(countedOnJob);
      this.logger.log(
        `[${label}] < ${config.name} ${jobCount} jobs in ${Date.now() - boardStart}ms${signal.aborted ? ' (ABORTED)' : ''}`,
      );
    } catch (e) {
      const err = e as Error;
      this.logger.error(
        `[${label}] × ${config.name} crashed after ${jobCount} jobs in ${Date.now() - boardStart}ms: ${err.stack ?? err.message ?? String(e)}`,
      );
      throw e;
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          this.logger.warn(
            `[${label}] ${config.name} browser.close() failed: ${(e as Error).message}`,
          );
        }
      }
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
