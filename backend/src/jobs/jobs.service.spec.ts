jest.mock('../../generated/prisma/client', () => ({}));
jest.mock('../prisma/prisma.service');

import { JobsService } from './jobs.service';
import { JobSource } from '../../generated/prisma/enums';

describe('JobsService.buildCriteriaWhere', () => {
  let service: JobsService;
  let prismaMock: any;
  let rawCalls: { sql: string; values: string[] }[];

  beforeEach(() => {
    rawCalls = [];
    prismaMock = {
      $queryRawUnsafe: jest.fn((sql: string, ...values: string[]) => {
        rawCalls.push({ sql, values });
        return Promise.resolve([{ id: 'job-1' }]);
      }),
    };
    service = new JobsService(prismaMock);
  });

  it('matches any of the locations', async () => {
    const where = await service.buildCriteriaWhere([], ['Paris', 'Lyon']);

    expect(where.OR).toEqual([
      { location: { contains: 'Paris', mode: 'insensitive' } },
      { location: { contains: 'Lyon', mode: 'insensitive' } },
    ]);
    expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('matches any of the queries, every word of one being required', async () => {
    await service.buildCriteriaWhere(['dev back', 'data'], []);

    expect(rawCalls).toHaveLength(1);
    expect(rawCalls[0].sql).toContain(
      '(unaccent(title) ILIKE unaccent($1) AND unaccent(title) ILIKE unaccent($2)) OR (unaccent(title) ILIKE unaccent($3))',
    );
    expect(rawCalls[0].values).toEqual(['%dev%', '%back%', '%data%']);
  });

  it('keeps the single-criterion behaviour of the legacy helper', async () => {
    await service.buildQueryLocationWhere('dev', 'Paris');

    expect(rawCalls[0].values).toEqual(['%dev%']);
    expect(rawCalls[0].sql).toContain('(unaccent(title) ILIKE unaccent($1))');
  });

  it('builds an empty predicate when both lists are empty', async () => {
    const where = await service.buildCriteriaWhere([], []);

    expect(where).toEqual({});
    expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('ignores blank entries', async () => {
    const where = await service.buildCriteriaWhere(['  '], ['', ' ']);

    expect(where).toEqual({});
    expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});

describe('JobsService.findKnownByExternalIds', () => {
  it('returns an empty map without querying when given no ids', async () => {
    const prismaMock: any = { job: { findMany: jest.fn() } };
    const service = new JobsService(prismaMock);

    const result = await service.findKnownByExternalIds(
      JobSource.HELLOWORK,
      [],
    );

    expect(result.size).toBe(0);
    expect(prismaMock.job.findMany).not.toHaveBeenCalled();
  });

  it('keys the result by externalId', async () => {
    const scrapedAt = new Date('2026-01-01');
    const prismaMock: any = {
      job: {
        findMany: jest.fn().mockResolvedValue([
          { externalId: 'a', description: 'desc a', scrapedAt },
          { externalId: 'b', description: '', scrapedAt },
        ]),
      },
    };
    const service = new JobsService(prismaMock);

    const result = await service.findKnownByExternalIds(JobSource.HELLOWORK, [
      'a',
      'b',
      'c',
    ]);

    expect(result.get('a')).toEqual({ description: 'desc a', scrapedAt });
    expect(result.get('b')).toEqual({ description: '', scrapedAt });
    expect(result.has('c')).toBe(false);
    expect(prismaMock.job.findMany).toHaveBeenCalledWith({
      where: {
        source: JobSource.HELLOWORK,
        externalId: { in: ['a', 'b', 'c'] },
      },
      select: { externalId: true, description: true, scrapedAt: true },
    });
  });
});
