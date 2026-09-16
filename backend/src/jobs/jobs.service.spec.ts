jest.mock('../../generated/prisma/client', () => ({}));
jest.mock('../prisma/prisma.service');

import { JobsService } from './jobs.service';

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
