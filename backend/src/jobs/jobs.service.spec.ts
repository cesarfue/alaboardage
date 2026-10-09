jest.mock('../../generated/prisma/client', () => ({}));
jest.mock('../prisma/prisma.service');

import { JobsService } from './jobs.service';
import { JobSource } from '../../generated/prisma/enums';
import type { InteractionStatus } from '../../generated/prisma/enums';
import type { CreateJobDto } from './dto/create-job.dto';

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

describe('JobsService.findByCriteria', () => {
  function mockPrisma() {
    return {
      job: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    } as any;
  }

  it('does not apply the date cutoff to jobs reached only via foundSearchId', async () => {
    const prismaMock = mockPrisma();
    const service = new JobsService(prismaMock);
    const postedSince = new Date('2026-01-01');

    await service.findByCriteria([], [], 50, 0, postedSince, {
      foundSearchId: 'search-1',
    });

    expect(prismaMock.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { interactions: { some: { foundSearchId: 'search-1' } } },
      }),
    );
  });

  it('bypasses the date cutoff only on the foundSearchId branch when criteria are also given', async () => {
    const prismaMock = mockPrisma();
    const service = new JobsService(prismaMock);
    const postedSince = new Date('2026-01-01');

    await service.findByCriteria([], ['Paris'], 50, 0, postedSince, {
      foundSearchId: 'search-1',
    });

    const where = prismaMock.job.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      {
        OR: [{ location: { contains: 'Paris', mode: 'insensitive' } }],
        datePosted: { gte: postedSince },
      },
      { interactions: { some: { foundSearchId: 'search-1' } } },
    ]);
    expect(where.datePosted).toBeUndefined();
  });

  it('applies the date cutoff normally when there is no foundSearchId', async () => {
    const prismaMock = mockPrisma();
    const service = new JobsService(prismaMock);
    const postedSince = new Date('2026-01-01');

    await service.findByCriteria([], [], 50, 0, postedSince, {});

    expect(prismaMock.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { datePosted: { gte: postedSince } } }),
    );
  });

  it('bypasses the date cutoff on the criteria branch when filtering by status, even without foundSearchId', async () => {
    const prismaMock = mockPrisma();
    const service = new JobsService(prismaMock);
    const postedSince = new Date('2026-01-01');

    await service.findByCriteria(['DevOps'], ['Lyon'], 50, 0, postedSince, {
      status: 'APPLIED' as InteractionStatus,
    });

    const where = prismaMock.job.findMany.mock.calls[0][0].where;
    expect(where.datePosted).toBeUndefined();
    expect(where.interactions).toEqual({ some: { status: 'APPLIED' } });
  });
});

describe('JobsService.findByAnyCriteria', () => {
  function mockPrisma() {
    return {
      job: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    } as any;
  }

  it('does not apply the date cutoff when filtering by status', async () => {
    const prismaMock = mockPrisma();
    const service = new JobsService(prismaMock);
    const postedSince = new Date('2026-01-01');

    await service.findByAnyCriteria(
      [{ queries: [], locations: [] }],
      50,
      0,
      postedSince,
      { status: 'APPLIED' as never },
    );

    const where = prismaMock.job.findMany.mock.calls[0][0].where;
    expect(where.datePosted).toBeUndefined();
    expect(where.interactions).toEqual({ some: { status: 'APPLIED' } });
  });

  it('applies the date cutoff normally when there is no status filter', async () => {
    const prismaMock = mockPrisma();
    const service = new JobsService(prismaMock);
    const postedSince = new Date('2026-01-01');

    await service.findByAnyCriteria(
      [{ queries: [], locations: [] }],
      50,
      0,
      postedSince,
      {},
    );

    expect(prismaMock.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ datePosted: { gte: postedSince } }),
      }),
    );
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

describe('JobsService.upsert', () => {
  function baseDto(overrides: Partial<CreateJobDto> = {}): CreateJobDto {
    return {
      externalId: 'ext-1',
      source: JobSource.HELLOWORK,
      title: 'Data Engineer',
      company: 'Acme',
      location: 'Lyon',
      description: '',
      url: 'https://example.com/job/1',
      datePosted: new Date('2026-01-01'),
      ...overrides,
    };
  }

  it('includes a non-empty description in the update payload', async () => {
    const prismaMock: any = {
      job: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const service = new JobsService(prismaMock);

    await service.upsert(baseDto({ description: 'Full text.' }));

    const call = prismaMock.job.upsert.mock.calls[0][0];
    expect(call.update.description).toBe('Full text.');
  });

  it('omits description from the update payload when the scrape returned an empty one', async () => {
    const prismaMock: any = {
      job: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const service = new JobsService(prismaMock);

    await service.upsert(baseDto({ description: '' }));

    const call = prismaMock.job.upsert.mock.calls[0][0];
    expect(call.update.description).toBeUndefined();
  });

  it('still sets description on create, even when empty', async () => {
    const prismaMock: any = {
      job: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const service = new JobsService(prismaMock);

    await service.upsert(baseDto({ description: '' }));

    const call = prismaMock.job.upsert.mock.calls[0][0];
    expect(call.create.description).toBe('');
  });
});
