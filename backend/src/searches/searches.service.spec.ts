jest.mock('../../generated/prisma/client', () => ({}));
jest.mock('../prisma/prisma.service');

import { NotFoundException } from '@nestjs/common';
import { SearchesService } from './searches.service';
import { JobsService } from '../jobs/jobs.service';

describe('SearchesService', () => {
  let service: SearchesService;
  let prismaMock: any;
  let jobsMock: jest.Mocked<
    Pick<
      JobsService,
      | 'countMatchingSince'
      | 'findByAnyCriteria'
      | 'findByCriteria'
      | 'newJobIdsSince'
    >
  >;
  let refreshMock: any;

  beforeEach(() => {
    prismaMock = {
      savedSearch: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    jobsMock = {
      countMatchingSince: jest.fn().mockResolvedValue(0),
      findByAnyCriteria: jest.fn(),
      findByCriteria: jest.fn(),
      newJobIdsSince: jest.fn().mockResolvedValue([]),
    };
    refreshMock = {
      stateOf: jest.fn().mockReturnValue('idle'),
      requestRefresh: jest.fn().mockReturnValue('queued'),
    };
    service = new SearchesService(
      prismaMock,
      jobsMock as unknown as JobsService,
      refreshMock,
    );
  });

  describe('getSavedSearches', () => {
    it('adds newResultsCount for each search', async () => {
      prismaMock.savedSearch.findMany.mockResolvedValue([
        {
          id: 's1',
          query: 'ts',
          location: 'Paris',
          queries: ['ts', 'node'],
          locations: ['Paris', 'Lyon'],
          lastSeenAt: null,
        },
        {
          id: 's2',
          query: 'go',
          location: 'Lyon',
          queries: [],
          locations: [],
          lastSeenAt: new Date('2026-07-01'),
        },
      ]);
      jobsMock.countMatchingSince
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(0);

      const result = await service.getSavedSearches();

      expect(result).toHaveLength(2);
      expect(result[0].newResultsCount).toBe(7);
      expect(result[1].newResultsCount).toBe(0);
      expect(jobsMock.countMatchingSince).toHaveBeenNthCalledWith(
        1,
        ['ts', 'node'],
        ['Paris', 'Lyon'],
        null,
        null,
      );
      expect(jobsMock.countMatchingSince).toHaveBeenNthCalledWith(
        2,
        ['go'],
        ['Lyon'],
        new Date('2026-07-01'),
        null,
      );
    });

    it('passes a datePosted cutoff derived from daysFilter', async () => {
      prismaMock.savedSearch.findMany.mockResolvedValue([
        {
          id: 's1',
          query: 'ts',
          location: 'Paris',
          queries: ['ts'],
          locations: ['Paris'],
          lastSeenAt: null,
        },
      ]);

      await service.getSavedSearches(14);

      const [, , , postedSince] = jobsMock.countMatchingSince.mock.calls[0];
      expect(postedSince).toBeInstanceOf(Date);
      const ageMs = Date.now() - (postedSince as Date).getTime();
      expect(ageMs).toBeGreaterThan(13 * 24 * 60 * 60 * 1000);
      expect(ageMs).toBeLessThan(15 * 24 * 60 * 60 * 1000);
    });
  });

  describe('feed', () => {
    it('counts a new job once even when two searches match it', async () => {
      prismaMock.savedSearch.findMany.mockResolvedValue([
        {
          id: 's1',
          query: '',
          location: '',
          queries: ['dev'],
          locations: ['Paris'],
          lastSeenAt: null,
        },
        {
          id: 's2',
          query: '',
          location: '',
          queries: ['dev'],
          locations: ['Lyon'],
          lastSeenAt: null,
        },
      ]);
      jobsMock.findByAnyCriteria.mockResolvedValue({
        items: [],
        total: 0,
        limit: 200,
        offset: 0,
      });
      jobsMock.newJobIdsSince
        .mockResolvedValueOnce(['a', 'b'])
        .mockResolvedValueOnce(['b', 'c']);

      const result = await service.feed(200, 0);

      expect(result.newCount).toBe(3);
      expect(jobsMock.findByAnyCriteria).toHaveBeenCalledWith(
        [
          { queries: ['dev'], locations: ['Paris'] },
          { queries: ['dev'], locations: ['Lyon'] },
        ],
        200,
        0,
        null,
      );
    });
  });

  describe('findJobsFor', () => {
    it('passes no cutoff when daysFilter is omitted', async () => {
      prismaMock.savedSearch.findFirst.mockResolvedValue({
        id: 's1',
        queries: ['ts'],
        locations: ['Paris'],
      });
      jobsMock.findByCriteria.mockResolvedValue({
        items: [],
        total: 0,
        limit: 200,
        offset: 0,
      });

      await service.findJobsFor('s1', 200, 0);

      expect(jobsMock.findByCriteria).toHaveBeenCalledWith(
        ['ts'],
        ['Paris'],
        200,
        0,
        null,
      );
    });

    it('derives a datePosted cutoff from daysFilter', async () => {
      prismaMock.savedSearch.findFirst.mockResolvedValue({
        id: 's1',
        queries: ['ts'],
        locations: ['Paris'],
      });
      jobsMock.findByCriteria.mockResolvedValue({
        items: [],
        total: 0,
        limit: 200,
        offset: 0,
      });

      await service.findJobsFor('s1', 200, 0, 14);

      const [, , , , postedSince] = jobsMock.findByCriteria.mock.calls[0];
      expect(postedSince).toBeInstanceOf(Date);
      const ageMs = Date.now() - (postedSince as Date).getTime();
      expect(ageMs).toBeGreaterThan(13 * 24 * 60 * 60 * 1000);
      expect(ageMs).toBeLessThan(15 * 24 * 60 * 60 * 1000);
    });

    it('throws NotFoundException when the search does not exist', async () => {
      prismaMock.savedSearch.findFirst.mockResolvedValue(null);
      await expect(service.findJobsFor('ghost', 200, 0)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('markSeen', () => {
    it('updates lastSeenAt and returns the row', async () => {
      prismaMock.savedSearch.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.savedSearch.findFirst.mockResolvedValue({
        id: 's1',
        lastSeenAt: new Date(),
      });

      const result = await service.markSeen('s1');

      const args = prismaMock.savedSearch.updateMany.mock.calls[0][0];
      expect(args.where).toEqual({ id: 's1' });
      expect(args.data.lastSeenAt).toBeInstanceOf(Date);
      expect(result.id).toBe('s1');
    });

    it('throws NotFoundException when no row matched', async () => {
      prismaMock.savedSearch.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.markSeen('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('createSavedSearch', () => {
    it('places the new search last', async () => {
      prismaMock.savedSearch.count.mockResolvedValue(3);
      prismaMock.savedSearch.create.mockResolvedValue({ id: 's4' });

      await service.createSavedSearch({
        name: 'n',
        queries: ['ts'],
        locations: ['Paris'],
      });

      const data = prismaMock.savedSearch.create.mock.calls[0][0].data;
      expect(data.position).toBe(3);
    });
  });

  describe('reorder', () => {
    it('writes one position per id', async () => {
      await service.reorder(['s2', 's1']);

      const calls = prismaMock.savedSearch.updateMany.mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(calls).toEqual([
        { where: { id: 's2' }, data: { position: 0 } },
        { where: { id: 's1' }, data: { position: 1 } },
      ]);
    });
  });

  describe('updateSavedSearch', () => {
    it('only writes provided fields', async () => {
      prismaMock.savedSearch.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.savedSearch.findFirst.mockResolvedValue({ id: 's1' });

      await service.updateSavedSearch('s1', { name: 'New name' });

      const data = prismaMock.savedSearch.updateMany.mock.calls[0][0].data;
      expect(data).toEqual({ name: 'New name' });
    });

    it('throws NotFoundException when the search does not exist', async () => {
      prismaMock.savedSearch.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.updateSavedSearch('s1', { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteSavedSearch', () => {
    it('throws NotFoundException when nothing was deleted', async () => {
      prismaMock.savedSearch.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.deleteSavedSearch('s1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes the matching search', async () => {
      prismaMock.savedSearch.deleteMany.mockResolvedValue({ count: 1 });
      await expect(service.deleteSavedSearch('s1')).resolves.toBeUndefined();
      expect(prismaMock.savedSearch.deleteMany).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
    });
  });
});
