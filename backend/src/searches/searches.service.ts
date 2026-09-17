import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { CreateSearchDto } from './dto/create-search.dto';
import { UpdateSearchDto } from './dto/update-search.dto';
import type { SavedSearch } from '../../generated/prisma/client';
import { criteriaOf } from './criteria';
import {
  RefreshState,
  SearchRefreshService,
} from '../search-refresh/search-refresh.service';

export interface SavedSearchWithCount extends SavedSearch {
  newResultsCount: number;
  refreshState: RefreshState;
}

@Injectable()
export class SearchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly refresh: SearchRefreshService,
  ) {}

  async getSavedSearches(userId: string): Promise<SavedSearchWithCount[]> {
    const searches = await this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });

    // `lastSeenAt === null` → treat all matching jobs as new
    // Bounded by user count × per-user saved searches — an N+1 here is fine
    return Promise.all(
      searches.map(async (s) => {
        const { queries, locations } = criteriaOf(s);
        return {
          ...s,
          refreshState: this.refresh.stateOf(s.id),
          newResultsCount: await this.jobs.countMatchingSince(
            queries,
            locations,
            s.lastSeenAt,
          ),
        };
      }),
    );
  }

  async createSavedSearch(userId: string, dto: CreateSearchDto) {
    const position = await this.prisma.savedSearch.count({ where: { userId } });
    return this.prisma.savedSearch.create({
      data: {
        userId,
        name: dto.name,
        queries: dto.queries,
        locations: dto.locations,
        query: dto.queries[0],
        location: dto.locations[0],
        position,
      },
    });
  }

  async reorder(userId: string, ids: string[]): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.savedSearch.updateMany({
          where: { id, userId },
          data: { position },
        }),
      ),
    );
  }

  async updateSavedSearch(
    userId: string,
    id: string,
    dto: UpdateSearchDto,
  ): Promise<SavedSearch> {
    return this.updateOwnedOr404(userId, id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.emailAlerts !== undefined && { emailAlerts: dto.emailAlerts }),
      ...(dto.queries !== undefined && {
        queries: dto.queries,
        query: dto.queries[0],
      }),
      ...(dto.locations !== undefined && {
        locations: dto.locations,
        location: dto.locations[0],
      }),
    });
  }

  async requestRefresh(userId: string, id: string): Promise<RefreshState> {
    const search = await this.prisma.savedSearch.findFirst({
      where: { id, userId },
    });
    if (!search) throw new NotFoundException('Saved search not found');
    return this.refresh.requestRefresh(id);
  }

  async findJobsFor(userId: string, id: string, limit: number, offset: number) {
    const search = await this.prisma.savedSearch.findFirst({
      where: { id, userId },
    });
    if (!search) throw new NotFoundException('Saved search not found');
    const { queries, locations } = criteriaOf(search);
    return this.jobs.findByCriteria(queries, locations, userId, limit, offset);
  }

  async markSeen(userId: string, id: string): Promise<SavedSearch> {
    return this.updateOwnedOr404(userId, id, { lastSeenAt: new Date() });
  }

  async feed(userId: string, limit: number, offset: number) {
    const searches = await this.prisma.savedSearch.findMany({
      where: { userId },
    });
    const criteria = searches.map(criteriaOf);
    const [page, newIdLists] = await Promise.all([
      this.jobs.findByAnyCriteria(criteria, userId, limit, offset),
      Promise.all(
        searches.map((s) => {
          const { queries, locations } = criteriaOf(s);
          return this.jobs.newJobIdsSince(queries, locations, s.lastSeenAt);
        }),
      ),
    ]);
    const newCount = new Set(newIdLists.flat()).size;
    return { ...page, newCount };
  }

  async markAllSeen(userId: string): Promise<void> {
    await this.prisma.savedSearch.updateMany({
      where: { userId },
      data: { lastSeenAt: new Date() },
    });
  }

  async requestRefreshAll(userId: string): Promise<RefreshState[]> {
    const searches = await this.prisma.savedSearch.findMany({
      where: { userId },
      select: { id: true },
    });
    return searches.map((s) => this.refresh.requestRefresh(s.id));
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
