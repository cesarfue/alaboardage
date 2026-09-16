jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
}));
jest.mock('../../generated/prisma/client', () => ({}));
jest.mock('../prisma/prisma.service');

import { SearchRefreshService } from './search-refresh.service';

describe('SearchRefreshService', () => {
  let service: SearchRefreshService;
  let prismaMock: any;
  let scraperMock: any;

  beforeEach(() => {
    prismaMock = {
      savedSearch: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    scraperMock = {
      scrapeAllBoards: jest.fn().mockResolvedValue({ total: 3 }),
    };
    service = new SearchRefreshService(prismaMock, scraperMock);
  });

  it('does nothing when there are no saved searches', async () => {
    prismaMock.savedSearch.findMany.mockResolvedValue([]);
    await service.refreshAll();
    expect(scraperMock.scrapeAllBoards).not.toHaveBeenCalled();
    expect(prismaMock.savedSearch.updateMany).not.toHaveBeenCalled();
  });

  it('deduplicates by (query, location)', async () => {
    prismaMock.savedSearch.findMany.mockResolvedValue([
      { id: 'a', queries: ['ts'], locations: ['Paris'] },
      { id: 'b', queries: ['TS'], locations: ['paris'] }, // same pair, differs by case
      { id: 'c', queries: ['go'], locations: ['Lyon'] },
    ]);
    await service.refreshAll();
    expect(scraperMock.scrapeAllBoards).toHaveBeenCalledTimes(2);
  });

  it('expands a multi-criteria search into every (query, location) pair', async () => {
    prismaMock.savedSearch.findMany.mockResolvedValue([
      {
        id: 'a',
        query: 'ts',
        location: 'Paris',
        queries: ['ts', 'node', 'go'],
        locations: ['Paris', 'Lyon'],
      },
    ]);
    await service.refreshAll();
    expect(scraperMock.scrapeAllBoards).toHaveBeenCalledTimes(6);
  });

  it('scrapes a pair shared by two searches only once', async () => {
    prismaMock.savedSearch.findMany.mockResolvedValue([
      {
        id: 'a',
        query: '',
        location: '',
        queries: ['ts'],
        locations: ['Paris'],
      },
      {
        id: 'b',
        query: '',
        location: '',
        queries: ['ts', 'go'],
        locations: ['Paris'],
      },
    ]);
    await service.refreshAll();
    expect(scraperMock.scrapeAllBoards).toHaveBeenCalledTimes(2);
  });

  it('updates lastCheckedAt on every matching search of a dedup group', async () => {
    prismaMock.savedSearch.findMany.mockResolvedValue([
      { id: 'a', queries: ['ts'], locations: ['Paris'] },
      { id: 'b', queries: ['TS'], locations: ['paris'] },
    ]);
    await service.refreshAll();
    const call = prismaMock.savedSearch.updateMany.mock.calls[0][0];
    expect(call.where.id.in).toEqual(['a', 'b']);
    expect(call.data.lastCheckedAt).toBeInstanceOf(Date);
  });

  it('still marks lastCheckedAt when the scrape fails', async () => {
    prismaMock.savedSearch.findMany.mockResolvedValue([
      { id: 'a', queries: ['ts'], locations: ['Paris'] },
    ]);
    scraperMock.scrapeAllBoards.mockRejectedValueOnce(new Error('boom'));
    await service.refreshAll();
    expect(prismaMock.savedSearch.updateMany).toHaveBeenCalled();
  });

  it('skips concurrent runs (re-entrancy guard)', async () => {
    let resolveFirst!: (v: { total: number }) => void;
    prismaMock.savedSearch.findMany.mockResolvedValue([
      { id: 'a', queries: ['ts'], locations: ['Paris'] },
    ]);
    scraperMock.scrapeAllBoards.mockReturnValueOnce(
      new Promise((res) => {
        resolveFirst = res;
      }),
    );

    const first = service.refreshAll();
    // Fire a second run while the first is mid-flight
    const second = service.refreshAll();

    resolveFirst({ total: 0 });
    await first;
    await second;

    // findMany should have been called exactly once (the second run was skipped)
    expect(prismaMock.savedSearch.findMany).toHaveBeenCalledTimes(1);
  });

  describe('on-demand refresh queue', () => {
    function pending() {
      let release!: () => void;
      const promise = new Promise<{ total: number }>((res) => {
        release = () => res({ total: 0 });
      });
      return { promise, release };
    }

    it('runs queued searches one after another, never two at once', async () => {
      prismaMock.savedSearch.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve({
          id: where.id,
          queries: [`q-${where.id}`],
          locations: ['Paris'],
        }),
      );
      const first = pending();
      const second = pending();
      scraperMock.scrapeAllBoards
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      expect(service.requestRefresh('a')).toBe('running');
      expect(service.requestRefresh('b')).toBe('queued');
      await Promise.resolve();
      expect(scraperMock.scrapeAllBoards).toHaveBeenCalledTimes(1);

      first.release();
      await new Promise((r) => setTimeout(r, 0));
      expect(scraperMock.scrapeAllBoards).toHaveBeenCalledTimes(2);
      expect(service.stateOf('b')).toBe('running');

      second.release();
      await new Promise((r) => setTimeout(r, 0));
      expect(service.stateOf('a')).toBe('idle');
      expect(service.stateOf('b')).toBe('idle');
    });

    it('does not queue the same search twice', async () => {
      prismaMock.savedSearch.findUnique.mockResolvedValue({
        id: 'a',
        queries: ['q'],
        locations: ['Paris'],
      });
      const held = pending();
      scraperMock.scrapeAllBoards.mockReturnValueOnce(held.promise);

      service.requestRefresh('a');
      service.requestRefresh('b');
      service.requestRefresh('b');
      expect(service.stateOf('b')).toBe('queued');

      held.release();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      expect(scraperMock.scrapeAllBoards).toHaveBeenCalledTimes(2);
    });
  });

  it('caps the number of pairs per run', async () => {
    const searches = Array.from({ length: 45 }, (_, i) => ({
      id: `id-${i}`,
      queries: [`q-${i}`],
      locations: [`loc-${i}`],
    }));
    prismaMock.savedSearch.findMany.mockResolvedValue(searches);
    await service.refreshAll();
    expect(scraperMock.scrapeAllBoards).toHaveBeenCalledTimes(40);
  });
});
