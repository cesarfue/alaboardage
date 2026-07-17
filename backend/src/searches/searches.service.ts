import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { CreateSearchDto } from './dto/create-search.dto';
import { UpdateSearchDto } from './dto/update-search.dto';
import type { SavedSearch } from '../../generated/prisma/client';

export interface SavedSearchWithCount extends SavedSearch {
  newResultsCount: number;
}

@Injectable()
export class SearchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  async getSavedSearches(userId: string): Promise<SavedSearchWithCount[]> {
    const searches = await this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // `lastSeenAt === null` → treat all matching jobs as new
    // Bounded by user count × per-user saved searches — an N+1 here is fine
    return Promise.all(
      searches.map(async (s) => ({
        ...s,
        newResultsCount: await this.jobs.countMatchingSince(
          s.query,
          s.location,
          s.lastSeenAt,
        ),
      })),
    );
  }

  createSavedSearch(userId: string, dto: CreateSearchDto) {
    return this.prisma.savedSearch.create({
      data: {
        userId,
        name: dto.name,
        query: dto.query,
        location: dto.location,
      },
    });
  }

  async updateSavedSearch(
    userId: string,
    id: string,
    dto: UpdateSearchDto,
  ): Promise<SavedSearch> {
    return this.updateOwnedOr404(userId, id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.emailAlerts !== undefined && { emailAlerts: dto.emailAlerts }),
    });
  }

  async markSeen(userId: string, id: string): Promise<SavedSearch> {
    return this.updateOwnedOr404(userId, id, { lastSeenAt: new Date() });
  }

  /**
   * Update-then-fetch scoped by (id, userId). Throws 404 when no row belongs
   * to the caller so downstream never sees a null. Both the `updateMany` and
   * the `findUnique` are ownership-scoped to defeat any interleaved delete.
   */
  private async updateOwnedOr404(
    userId: string,
    id: string,
    data: UpdateSearchDto & { lastSeenAt?: Date },
  ): Promise<SavedSearch> {
    const result = await this.prisma.savedSearch.updateMany({
      where: { id, userId },
      data,
    });
    if (result.count === 0) {
      throw new NotFoundException('Saved search not found');
    }
    const updated = await this.prisma.savedSearch.findFirst({
      where: { id, userId },
    });
    if (!updated) throw new NotFoundException('Saved search not found');
    return updated;
  }

  async deleteSavedSearch(userId: string, id: string) {
    const result = await this.prisma.savedSearch.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Saved search not found');
    }
  }
}
