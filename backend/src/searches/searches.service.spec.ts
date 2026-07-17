jest.mock('../../generated/prisma/client', () => ({}));
jest.mock('../prisma/prisma.service');

import { NotFoundException } from '@nestjs/common';
import { SearchesService } from './searches.service';
import { JobsService } from '../jobs/jobs.service';

describe('SearchesService', () => {
  let service: SearchesService;
  let prismaMock: any;
  let jobsMock: jest.Mocked<Pick<JobsService, 'countMatchingSince'>>;

  beforeEach(() => {
    prismaMock = {
      savedSearch: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    jobsMock = {
      countMatchingSince: jest.fn().mockResolvedValue(0),
    };
    service = new SearchesService(prismaMock, jobsMock as unknown as JobsService);
  });

  describe('getSavedSearches', () => {
    it('adds newResultsCount for each search', async () => {
      prismaMock.savedSearch.findMany.mockResolvedValue([
        { id: 's1', query: 'ts', location: 'Paris', lastSeenAt: null },
        {
          id: 's2',
          query: 'go',
          location: 'Lyon',
          lastSeenAt: new Date('2026-07-01'),
        },
      ]);
      jobsMock.countMatchingSince
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(0);

      const result = await service.getSavedSearches('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].newResultsCount).toBe(7);
      expect(result[1].newResultsCount).toBe(0);
      expect(jobsMock.countMatchingSince).toHaveBeenNthCalledWith(
        1,
        'ts',
        'Paris',
        null,
      );
      expect(jobsMock.countMatchingSince).toHaveBeenNthCalledWith(
        2,
        'go',
        'Lyon',
        new Date('2026-07-01'),
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

      const result = await service.markSeen('user-1', 's1');

      const args = prismaMock.savedSearch.updateMany.mock.calls[0][0];
      expect(args.where).toEqual({ id: 's1', userId: 'user-1' });
      expect(args.data.lastSeenAt).toBeInstanceOf(Date);
      expect(result.id).toBe('s1');
    });

    it('throws NotFoundException when no row matched', async () => {
      prismaMock.savedSearch.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.markSeen('user-1', 'ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateSavedSearch', () => {
    it('only writes provided fields', async () => {
      prismaMock.savedSearch.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.savedSearch.findFirst.mockResolvedValue({ id: 's1' });

      await service.updateSavedSearch('user-1', 's1', { emailAlerts: false });

      const data = prismaMock.savedSearch.updateMany.mock.calls[0][0].data;
      expect(data).toEqual({ emailAlerts: false });
    });

    it('supports renaming a search', async () => {
      prismaMock.savedSearch.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.savedSearch.findFirst.mockResolvedValue({ id: 's1' });

      await service.updateSavedSearch('user-1', 's1', { name: 'New name' });

      const data = prismaMock.savedSearch.updateMany.mock.calls[0][0].data;
      expect(data).toEqual({ name: 'New name' });
    });

    it('throws NotFoundException when the search does not belong to the user', async () => {
      prismaMock.savedSearch.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.updateSavedSearch('user-1', 's1', { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteSavedSearch', () => {
    it('throws NotFoundException when nothing was deleted', async () => {
      prismaMock.savedSearch.deleteMany.mockResolvedValue({ count: 0 });
      await expect(
        service.deleteSavedSearch('user-1', 's1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes when the search belongs to the user', async () => {
      prismaMock.savedSearch.deleteMany.mockResolvedValue({ count: 1 });
      await expect(
        service.deleteSavedSearch('user-1', 's1'),
      ).resolves.toBeUndefined();
      expect(prismaMock.savedSearch.deleteMany).toHaveBeenCalledWith({
        where: { id: 's1', userId: 'user-1' },
      });
    });
  });
});
