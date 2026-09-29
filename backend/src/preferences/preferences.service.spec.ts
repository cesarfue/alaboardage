jest.mock('../../generated/prisma/client', () => ({}));
jest.mock('../prisma/prisma.service');

import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  let service: PreferencesService;
  let prismaMock: any;
  let stored: Record<string, unknown> | null;

  beforeEach(() => {
    stored = null;
    prismaMock = {
      userPreference: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(stored)),
        upsert: jest
          .fn()
          .mockImplementation(({ create, update }) =>
            Promise.resolve({ ...(stored ?? create), ...update }),
          ),
      },
    };
    service = new PreferencesService(prismaMock);
  });

  it('returns empty preferences when nothing is stored', async () => {
    await expect(service.get('u1')).resolves.toEqual({
      lastView: null,
      listAnchors: {},
      filters: null,
    });
  });

  it('merges a new anchor into the stored ones', async () => {
    stored = {
      userId: 'u1',
      lastView: { kind: 'all' },
      listAnchors: { all: 'a' },
    };
    const res = await service.update('u1', {
      anchor: { tab: 'saved:s1', jobId: 'b' },
    });
    expect(res.listAnchors).toEqual({ all: 'a', 'saved:s1': 'b' });
    expect(res.lastView).toEqual({ kind: 'all' });
    const update = prismaMock.userPreference.upsert.mock.calls[0][0].update;
    expect(update).not.toHaveProperty('lastView');
  });

  it('drops an anchor when jobId is null and keeps lastView otherwise', async () => {
    stored = {
      userId: 'u1',
      lastView: { kind: 'all' },
      listAnchors: { all: 'a', new: 'z' },
    };
    const res = await service.update('u1', {
      lastView: { kind: 'suivi' },
      anchor: { tab: 'new', jobId: null },
    });
    expect(res.listAnchors).toEqual({ all: 'a' });
    expect(res.lastView).toEqual({ kind: 'suivi' });
  });

  it('ignores malformed stored anchors', async () => {
    stored = {
      userId: 'u1',
      lastView: null,
      listAnchors: ['not', 'an', 'object'],
    };
    await expect(service.get('u1')).resolves.toEqual({
      lastView: null,
      listAnchors: {},
      filters: null,
    });
  });

  it('stores and returns filters', async () => {
    stored = { userId: 'u1', lastView: null, listAnchors: {} };
    const res = await service.update('u1', {
      filters: { radiusKm: 100, daysFilter: null, hideViewed: true },
    });
    expect(res.filters).toEqual({
      radiusKm: 100,
      daysFilter: null,
      hideViewed: true,
    });
  });

  it('keeps filters untouched when the update omits them', async () => {
    stored = {
      userId: 'u1',
      lastView: null,
      listAnchors: {},
      filters: { radiusKm: 60, daysFilter: 30, hideViewed: false },
    };
    const res = await service.update('u1', { lastView: { kind: 'all' } });
    expect(res.filters).toEqual({
      radiusKm: 60,
      daysFilter: 30,
      hideViewed: false,
    });
    const update = prismaMock.userPreference.upsert.mock.calls[0][0].update;
    expect(update).not.toHaveProperty('filters');
  });

  it('ignores malformed stored filters', async () => {
    stored = {
      userId: 'u1',
      lastView: null,
      listAnchors: {},
      filters: { radiusKm: 'not-a-number' },
    };
    await expect(service.get('u1')).resolves.toMatchObject({ filters: null });
  });
});
