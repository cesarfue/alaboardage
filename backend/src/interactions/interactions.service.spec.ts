jest.mock('../../generated/prisma/client', () => ({}));
jest.mock('../prisma/prisma.service');

import { InteractionsService } from './interactions.service';

describe('InteractionsService views', () => {
  let service: InteractionsService;
  let prismaMock: any;
  let stored: { jobId: string }[];

  beforeEach(() => {
    stored = [];
    prismaMock = {
      jobView: {
        upsert: jest.fn(({ where, create }: any) => {
          const existing = stored.find((v) => v.jobId === where.jobId);
          if (!existing) stored.push({ ...create });
          return Promise.resolve(existing ?? create);
        }),
        findMany: jest.fn(() =>
          Promise.resolve(stored.map(({ jobId }) => ({ jobId }))),
        ),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new InteractionsService(prismaMock);
  });

  it('records a view once for the same job', async () => {
    await service.markViewed('job-1');
    await service.markViewed('job-1');

    expect(stored).toHaveLength(1);
    expect(await service.getViewedJobIds()).toEqual(['job-1']);
  });

  it('tracks multiple jobs', async () => {
    await service.markViewed('job-1');
    await service.markViewed('job-2');

    expect(await service.getViewedJobIds()).toEqual(['job-1', 'job-2']);
  });

  it('returns an empty list when nothing was viewed', async () => {
    expect(await service.getViewedJobIds()).toEqual([]);
  });

  it('bulk-marks several jobs as viewed, skipping ones already viewed', async () => {
    stored = [{ jobId: 'job-1' }];
    await service.bulkSetViewed(['job-1', 'job-2', 'job-3'], true);

    expect(await service.getViewedJobIds()).toEqual(
      expect.arrayContaining(['job-1', 'job-2', 'job-3']),
    );
  });
});

describe('InteractionsService status', () => {
  let service: InteractionsService;
  let prismaMock: any;
  let stored: Map<
    string,
    {
      jobId: string;
      status: string;
      foundSearchId?: string;
      foundSearchName?: string;
    }
  >;

  beforeEach(() => {
    stored = new Map();
    prismaMock = {
      jobInteraction: {
        upsert: jest.fn(({ where, create, update }: any) => {
          const existing = stored.get(where.jobId);
          const row = existing ? { ...existing, ...update } : { ...create };
          stored.set(where.jobId, row);
          return Promise.resolve(row);
        }),
        deleteMany: jest.fn(({ where }: any) => {
          const ids: string[] = where.jobId?.in ?? [where.jobId];
          const before = stored.size;
          for (const id of ids) stored.delete(id);
          return Promise.resolve({ count: before - stored.size });
        }),
        findMany: jest.fn(() =>
          Promise.resolve(
            [...stored.values()].map((r) => ({
              jobId: r.jobId,
              status: r.status,
              updatedAt: new Date(),
            })),
          ),
        ),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new InteractionsService(prismaMock);
  });

  it('records the originating search only when the row is created', async () => {
    await service.upsertInteraction('job-1', 'SAVED', 'search-1', 'Dev Lyon');
    await service.upsertInteraction(
      'job-1',
      'APPLIED',
      'search-2',
      'Other search',
    );

    expect(stored.get('job-1')).toMatchObject({
      status: 'APPLIED',
      foundSearchId: 'search-1',
      foundSearchName: 'Dev Lyon',
    });
  });

  it('bulk-sets a status for every id in the list', async () => {
    await service.bulkSetInteractions(
      ['job-1', 'job-2'],
      'SAVED',
      'search-1',
      'Dev Lyon',
    );

    expect(stored.get('job-1')).toMatchObject({ status: 'SAVED' });
    expect(stored.get('job-2')).toMatchObject({ status: 'SAVED' });
  });

  it('bulk-clears the status for every id when status is null', async () => {
    stored.set('job-1', { jobId: 'job-1', status: 'SAVED' });
    stored.set('job-2', { jobId: 'job-2', status: 'APPLIED' });

    await service.bulkSetInteractions(['job-1', 'job-2'], null);

    expect(stored.size).toBe(0);
  });
});
