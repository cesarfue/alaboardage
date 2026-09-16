jest.mock('../../generated/prisma/client', () => ({}));
jest.mock('../prisma/prisma.service');

import { InteractionsService } from './interactions.service';

describe('InteractionsService views', () => {
  let service: InteractionsService;
  let prismaMock: any;
  let stored: { userId: string; jobId: string }[];

  beforeEach(() => {
    stored = [];
    prismaMock = {
      jobView: {
        upsert: jest.fn(({ where, create }: any) => {
          const key = where.userId_jobId;
          const existing = stored.find(
            (v) => v.userId === key.userId && v.jobId === key.jobId,
          );
          if (!existing) stored.push({ ...create });
          return Promise.resolve(existing ?? create);
        }),
        findMany: jest.fn(({ where }: any) =>
          Promise.resolve(
            stored
              .filter((v) => v.userId === where.userId)
              .map(({ jobId }) => ({ jobId })),
          ),
        ),
      },
    };
    service = new InteractionsService(prismaMock);
  });

  it('records a view once for the same user and job', async () => {
    await service.markViewed('user-1', 'job-1');
    await service.markViewed('user-1', 'job-1');

    expect(stored).toHaveLength(1);
    expect(await service.getViewedJobIds('user-1')).toEqual(['job-1']);
  });

  it('keeps each user views separate', async () => {
    await service.markViewed('user-1', 'job-1');
    await service.markViewed('user-2', 'job-2');

    expect(await service.getViewedJobIds('user-1')).toEqual(['job-1']);
    expect(await service.getViewedJobIds('user-2')).toEqual(['job-2']);
  });

  it('returns an empty list for a user who viewed nothing', async () => {
    expect(await service.getViewedJobIds('user-3')).toEqual([]);
  });
});
