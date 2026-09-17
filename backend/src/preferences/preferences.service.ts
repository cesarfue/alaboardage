import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma, UserPreference } from '../../generated/prisma/client';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

export interface Preferences {
  lastView: unknown;
  listAnchors: Record<string, string>;
}

function anchorsOf(row: UserPreference | null): Record<string, string> {
  const raw = row?.listAnchors;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(([, v]) => typeof v === 'string'),
  ) as Record<string, string>;
}

function shape(row: UserPreference | null): Preferences {
  return { lastView: row?.lastView ?? null, listAnchors: anchorsOf(row) };
}

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<Preferences> {
    const row = await this.prisma.userPreference.findUnique({
      where: { userId },
    });
    return shape(row);
  }

  async update(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<Preferences> {
    const current = await this.prisma.userPreference.findUnique({
      where: { userId },
    });
    const anchors = anchorsOf(current);
    if (dto.anchor) {
      if (dto.anchor.jobId === null) delete anchors[dto.anchor.tab];
      else anchors[dto.anchor.tab] = dto.anchor.jobId;
    }
    const lastView = dto.lastView as Prisma.InputJsonValue | undefined;
    const row = await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, lastView, listAnchors: anchors },
      update: {
        ...(lastView !== undefined && { lastView }),
        ...(dto.anchor && { listAnchors: anchors }),
      },
    });
    return shape(row);
  }
}
