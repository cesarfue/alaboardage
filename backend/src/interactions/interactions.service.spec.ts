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
});
