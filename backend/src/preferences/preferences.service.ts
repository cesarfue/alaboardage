import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma, UserPreference } from '../../generated/prisma/client';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

const SINGLETON_ID = 1;

export interface Filters {
  radiusKm: number;
  daysFilter: number | null;
  hideViewed: boolean;
}

export interface Preferences {
  lastView: unknown;
  listAnchors: Record<string, string>;
  filters: Filters | null;
  autoScrapeEnabled: boolean;
  autoScrapeIntervalMinutes: number;
}

function anchorsOf(row: UserPreference | null): Record<string, string> {
  const raw = row?.listAnchors;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(([, v]) => typeof v === 'string'),
  ) as Record<string, string>;
}

function filtersOf(row: UserPreference | null): Filters | null {
  const raw = row?.filters;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.radiusKm !== 'number' || typeof r.hideViewed !== 'boolean')
    return null;
  return {
    radiusKm: r.radiusKm,
    daysFilter: typeof r.daysFilter === 'number' ? r.daysFilter : null,
    hideViewed: r.hideViewed,
  };
}

function shape(row: UserPreference | null): Preferences {
  return {
    lastView: row?.lastView ?? null,
    listAnchors: anchorsOf(row),
    filters: filtersOf(row),
    autoScrapeEnabled: row?.autoScrapeEnabled ?? true,
    autoScrapeIntervalMinutes: row?.autoScrapeIntervalMinutes ?? 360,
  };
}

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Preferences> {
    const row = await this.prisma.userPreference.findUnique({
      where: { id: SINGLETON_ID },
    });
    return shape(row);
  }

  async update(dto: UpdatePreferencesDto): Promise<Preferences> {
    const current = await this.prisma.userPreference.findUnique({
      where: { id: SINGLETON_ID },
    });
    const anchors = anchorsOf(current);
    if (dto.anchor) {
      if (dto.anchor.jobId === null) delete anchors[dto.anchor.tab];
      else anchors[dto.anchor.tab] = dto.anchor.jobId;
    }
    const lastView = dto.lastView as Prisma.InputJsonValue | undefined;
    const filters = dto.filters as Prisma.InputJsonValue | undefined;
    const row = await this.prisma.userPreference.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        lastView,
        listAnchors: anchors,
        filters,
        ...(dto.autoScrapeEnabled !== undefined && {
          autoScrapeEnabled: dto.autoScrapeEnabled,
        }),
        ...(dto.autoScrapeIntervalMinutes !== undefined && {
          autoScrapeIntervalMinutes: dto.autoScrapeIntervalMinutes,
        }),
      },
      update: {
        ...(lastView !== undefined && { lastView }),
        ...(dto.anchor && { listAnchors: anchors }),
        ...(filters !== undefined && { filters }),
        ...(dto.autoScrapeEnabled !== undefined && {
          autoScrapeEnabled: dto.autoScrapeEnabled,
        }),
        ...(dto.autoScrapeIntervalMinutes !== undefined && {
          autoScrapeIntervalMinutes: dto.autoScrapeIntervalMinutes,
        }),
      },
    });
    return shape(row);
  }
}
