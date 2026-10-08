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

  it('returns default preferences when nothing is stored', async () => {
    await expect(service.get()).resolves.toEqual({
      lastView: null,
      listAnchors: {},
      filters: null,
      autoScrapeEnabled: true,
      autoScrapeIntervalMinutes: 360,
    });
  });

  it('merges a new anchor into the stored ones', async () => {
    stored = {
      id: 1,
      lastView: { kind: 'all' },
      listAnchors: { all: 'a' },
    };
    const res = await service.update({
      anchor: { tab: 'saved:s1', jobId: 'b' },
    });
    expect(res.listAnchors).toEqual({ all: 'a', 'saved:s1': 'b' });
    expect(res.lastView).toEqual({ kind: 'all' });
    const update = prismaMock.userPreference.upsert.mock.calls[0][0].update;
    expect(update).not.toHaveProperty('lastView');
  });

  it('drops an anchor when jobId is null and keeps lastView otherwise', async () => {
    stored = {
      id: 1,
      lastView: { kind: 'all' },
      listAnchors: { all: 'a', new: 'z' },
    };
    const res = await service.update({
      lastView: { kind: 'suivi' },
      anchor: { tab: 'new', jobId: null },
    });
    expect(res.listAnchors).toEqual({ all: 'a' });
    expect(res.lastView).toEqual({ kind: 'suivi' });
  });

  it('ignores malformed stored anchors', async () => {
    stored = {
      id: 1,
      lastView: null,
      listAnchors: ['not', 'an', 'object'],
    };
    await expect(service.get()).resolves.toEqual({
      lastView: null,
      listAnchors: {},
      filters: null,
      autoScrapeEnabled: true,
      autoScrapeIntervalMinutes: 360,
    });
  });

  it('stores and returns filters', async () => {
    stored = { id: 1, lastView: null, listAnchors: {} };
    const res = await service.update({
      filters: {
        radiusKm: 100,
        daysFilter: null,
        hideViewed: true,
        source: 'HELLOWORK',
        company: 'Acme',
        status: 'APPLIED',
        sortMode: 'score',
      },
    });
    expect(res.filters).toEqual({
      radiusKm: 100,
      daysFilter: null,
      hideViewed: true,
      source: 'HELLOWORK',
      company: 'Acme',
      status: 'APPLIED',
      sortMode: 'score',
    });
  });

  it('keeps filters untouched when the update omits them', async () => {
    stored = {
      id: 1,
      lastView: null,
      listAnchors: {},
      filters: {
        radiusKm: 60,
        daysFilter: 30,
        hideViewed: false,
        source: null,
        company: '',
        status: null,
        sortMode: 'date',
      },
    };
    const res = await service.update({ lastView: { kind: 'all' } });
    expect(res.filters).toEqual({
      radiusKm: 60,
      daysFilter: 30,
      hideViewed: false,
      source: null,
      company: '',
      status: null,
      sortMode: 'date',
    });
    const update = prismaMock.userPreference.upsert.mock.calls[0][0].update;
    expect(update).not.toHaveProperty('filters');
  });

  it('defaults source/company/status/sortMode when the stored blob predates them', async () => {
    stored = {
      id: 1,
      lastView: null,
      listAnchors: {},
      filters: { radiusKm: 60, daysFilter: 30, hideViewed: false },
    };
    await expect(service.get()).resolves.toMatchObject({
      filters: {
        radiusKm: 60,
        daysFilter: 30,
        hideViewed: false,
        source: null,
        company: '',
        status: null,
        sortMode: 'date',
      },
    });
  });

  it('ignores malformed stored filters', async () => {
    stored = {
      id: 1,
      lastView: null,
      listAnchors: {},
      filters: { radiusKm: 'not-a-number' },
    };
    await expect(service.get()).resolves.toMatchObject({ filters: null });
  });

  it('stores and returns auto-scrape settings', async () => {
    stored = { id: 1, lastView: null, listAnchors: {} };
    const res = await service.update({
      autoScrapeEnabled: false,
      autoScrapeIntervalMinutes: 90,
    });
    expect(res.autoScrapeEnabled).toBe(false);
    expect(res.autoScrapeIntervalMinutes).toBe(90);
  });

  it('keeps auto-scrape settings untouched when the update omits them', async () => {
    stored = {
      id: 1,
      lastView: null,
      listAnchors: {},
      autoScrapeEnabled: false,
      autoScrapeIntervalMinutes: 90,
    };
    const res = await service.update({ lastView: { kind: 'all' } });
    expect(res.autoScrapeEnabled).toBe(false);
    expect(res.autoScrapeIntervalMinutes).toBe(90);
    const update = prismaMock.userPreference.upsert.mock.calls[0][0].update;
    expect(update).not.toHaveProperty('autoScrapeEnabled');
    expect(update).not.toHaveProperty('autoScrapeIntervalMinutes');
  });
});
