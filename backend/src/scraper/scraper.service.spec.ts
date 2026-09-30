jest.mock('playwright', () => ({ chromium: { launch: jest.fn() } }));
jest.mock('../../generated/prisma/client', () => ({}));
jest.mock('../prisma/prisma.service');

import { chromium as chromiumImport } from 'playwright';
import { firstValueFrom, toArray } from 'rxjs';
import { ScraperService } from './scraper.service';
import type { CreateJobDto } from '../jobs/dto/create-job.dto';

const chromium = chromiumImport as unknown as { launch: jest.Mock };

describe('ScraperService', () => {
  let service: ScraperService;
  let jobsMock: any;
  let enrichmentMock: any;
  let scoringMock: any;
  let prismaMock: any;

  const jobDto = (externalId: string) =>
    ({ externalId, title: 'dev', company: 'acme' }) as unknown as CreateJobDto;

  beforeEach(() => {
    jobsMock = {
      upsert: jest.fn((dto: CreateJobDto) =>
        Promise.resolve({
          id: `job-${dto.externalId}`,
          company: dto.company,
          location: 'Paris',
        }),
      ),
    };
    enrichmentMock = {
      enrichJob: jest.fn().mockResolvedValue({ siret: '123', lat: 1, lng: 2 }),
      cancelEnrichment: jest.fn(),
    };
    scoringMock = {
      scoreJob: jest.fn().mockReturnValue(0),
      computeAndSave: jest.fn().mockResolvedValue(undefined),
    };
    prismaMock = { skill: { findMany: jest.fn().mockResolvedValue([]) } };
    chromium.launch.mockReset().mockResolvedValue({
      close: jest.fn().mockResolvedValue(undefined),
    });
    service = new ScraperService(
      jobsMock,
      enrichmentMock,
      scoringMock,
      prismaMock,
    );
  });

  function stubBoards(externalIds: string[]) {
    (service as any).scrapeStreaming = jest.fn(
      async (
        _dto: unknown,
        _browser: unknown,
        _signal: AbortSignal,
        onJob: (dto: CreateJobDto) => Promise<void>,
      ) => {
        for (const externalId of externalIds) await onJob(jobDto(externalId));
      },
    );
  }

  async function streamedJobIds(): Promise<string[]> {
    const events = await firstValueFrom(
      service
        .scrapeAllBoardsStream({ query: [], location: [] })
        .pipe(toArray()),
    );
    return events
      .map((e) => e.data as { type: string; job?: { id: string } })
      .filter((d) => d.type === 'job')
      .map((d) => d.job!.id);
  }

  it('streams a job once when a board serves it on two pages', async () => {
    stubBoards(['a', 'a']);
    expect(await streamedJobIds()).toEqual(['job-a']);
  });

  it('streams every distinct job', async () => {
    stubBoards(['a', 'b']);
    expect(await streamedJobIds()).toEqual(['job-a', 'job-b']);
  });

  it('enriches and counts a repeated job once during the cron run', async () => {
    stubBoards(['a', 'a']);
    const { total } = await service.scrapeAllBoards(
      'dev',
      'Paris',
      new AbortController().signal,
    );
    expect(total).toBe(1);
    expect(enrichmentMock.enrichJob).toHaveBeenCalledTimes(1);
  });

  it('launches a single shared browser per cron run, not one per source', async () => {
    stubBoards(['a', 'b']);
    await service.scrapeAllBoards('dev', 'Paris', new AbortController().signal);

    expect(chromium.launch).toHaveBeenCalledTimes(1);
    const browserResult = await chromium.launch.mock.results[0].value;
    expect(browserResult.close).toHaveBeenCalledTimes(1);
  });

  it('launches a single shared browser per pair in a streamed search', async () => {
    stubBoards(['a']);
    await streamedJobIds();

    expect(chromium.launch).toHaveBeenCalledTimes(1);
  });
});
