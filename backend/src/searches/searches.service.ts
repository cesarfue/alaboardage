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

function cutoffFrom(daysFilter: number | null): Date | null {
  return daysFilter !== null
    ? new Date(Date.now() - daysFilter * 24 * 60 * 60 * 1000)
    : null;
}

@Injectable()
export class SearchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly refresh: SearchRefreshService,
  ) {}

  async getSavedSearches(
    daysFilter: number | null = null,
  ): Promise<SavedSearchWithCount[]> {
    const searches = await this.prisma.savedSearch.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });
    const postedSince = cutoffFrom(daysFilter);

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
            postedSince,
          ),
        };
      }),
    );
  }

  async createSavedSearch(dto: CreateSearchDto) {
    const position = await this.prisma.savedSearch.count();
    return this.prisma.savedSearch.create({
      data: {
        name: dto.name,
        queries: dto.queries,
        locations: dto.locations,
        query: dto.queries[0],
        location: dto.locations[0],
        position,
      },
    });
  }

  async reorder(ids: string[]): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.savedSearch.updateMany({
          where: { id },
          data: { position },
        }),
      ),
    );
  }

  async updateSavedSearch(
    id: string,
    dto: UpdateSearchDto,
  ): Promise<SavedSearch> {
    return this.updateOr404(id, {
      ...(dto.name !== undefined && { name: dto.name }),
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

  async requestRefresh(id: string): Promise<RefreshState> {
    const search = await this.prisma.savedSearch.findFirst({ where: { id } });
    if (!search) throw new NotFoundException('Saved search not found');
    return this.refresh.requestRefresh(id);
  }

  async findJobsFor(id: string, limit: number, offset: number) {
    const search = await this.prisma.savedSearch.findFirst({ where: { id } });
    if (!search) throw new NotFoundException('Saved search not found');
    const { queries, locations } = criteriaOf(search);
    return this.jobs.findByCriteria(queries, locations, limit, offset);
  }

  async markSeen(id: string): Promise<SavedSearch> {
    return this.updateOr404(id, { lastSeenAt: new Date() });
  }

  async feed(limit: number, offset: number, daysFilter: number | null = null) {
    const searches = await this.prisma.savedSearch.findMany();
    const criteria = searches.map(criteriaOf);
    const postedSince = cutoffFrom(daysFilter);
    const [page, newIdLists] = await Promise.all([
      this.jobs.findByAnyCriteria(criteria, limit, offset),
      Promise.all(
        searches.map((s) => {
          const { queries, locations } = criteriaOf(s);
          return this.jobs.newJobIdsSince(
            queries,
            locations,
            s.lastSeenAt,
            postedSince,
          );
        }),
      ),
    ]);
    const newCount = new Set(newIdLists.flat()).size;
    return { ...page, newCount };
  }

  async markAllSeen(): Promise<void> {
    await this.prisma.savedSearch.updateMany({
      data: { lastSeenAt: new Date() },
    });
  }

  async requestRefreshAll(): Promise<RefreshState[]> {
    const searches = await this.prisma.savedSearch.findMany({
      select: { id: true },
    });
    return searches.map((s) => this.refresh.requestRefresh(s.id));
  }

  private async updateOr404(
    id: string,
    data: UpdateSearchDto & { lastSeenAt?: Date },
  ): Promise<SavedSearch> {
    const result = await this.prisma.savedSearch.updateMany({
      where: { id },
      data,
    });
    if (result.count === 0) {
      throw new NotFoundException('Saved search not found');
    }
    const updated = await this.prisma.savedSearch.findFirst({ where: { id } });
    if (!updated) throw new NotFoundException('Saved search not found');
    return updated;
  }

  async deleteSavedSearch(id: string) {
    const result = await this.prisma.savedSearch.deleteMany({ where: { id } });
    if (result.count === 0) {
      throw new NotFoundException('Saved search not found');
    }
  }
}
