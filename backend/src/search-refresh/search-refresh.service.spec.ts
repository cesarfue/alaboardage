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
