import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { FindJobsDto } from './dto/find-jobs-query.dto';
import type { Prisma } from '../../generated/prisma/client';
import type {
  InteractionStatus,
  JobSource,
} from '../../generated/prisma/enums';

export interface KnownJob {
  description: string;
  scrapedAt: Date;
}

export interface CriteriaFilterOptions {
  source?: JobSource;
  company?: string;
  status?: InteractionStatus;
  foundSearchId?: string;
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a Prisma `where` matching the same jobs the live search surfaces:
   * title contains every word of `query` (accent-insensitive) AND
   * location contains `location`.
   * Both filters are optional and skipped when empty.
   */
  async buildQueryLocationWhere(
    query: string | undefined,
    location: string | undefined,
  ): Promise<Prisma.JobWhereInput> {
    return this.buildCriteriaWhere(
      query ? [query] : [],
      location ? [location] : [],
    );
  }

  async buildCriteriaWhere(
    queries: string[],
    locations: string[],
  ): Promise<Prisma.JobWhereInput> {
    const where: Prisma.JobWhereInput = {};

    const usableLocations = locations.filter((l) => l.trim().length > 0);
    if (usableLocations.length > 0) {
      where.OR = usableLocations.map((l) => ({
        location: { contains: l, mode: 'insensitive' as const },
      }));
    }

    const wordGroups = queries
      .map((q) => q.trim().split(/\s+/).filter(Boolean))
      .filter((words) => words.length > 0);

    if (wordGroups.length > 0) {
      const values: string[] = [];
      const groups = wordGroups.map(
        (words) =>
          `(${words
            .map((w) => {
              values.push(`%${w}%`);
              return `unaccent(title) ILIKE unaccent($${values.length})`;
            })
            .join(' AND ')})`,
      );
      const rows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "Job" WHERE ${groups.join(' OR ')}`,
        ...values,
      );
      where.id = { in: rows.map((r) => r.id) };
    }

    return where;
  }

  private applyFilterOptions(
    where: Prisma.JobWhereInput,
    opts: CriteriaFilterOptions,
    postedSince: Date | null,
  ): void {
    if (postedSince && !opts.status) where.datePosted = { gte: postedSince };
    if (opts.source) where.source = opts.source;
    if (opts.company)
      where.company = { contains: opts.company, mode: 'insensitive' };
    if (opts.status) where.interactions = { some: { status: opts.status } };
  }

  private async scopedCriteriaWhere(
    queries: string[],
    locations: string[],
    foundSearchId: string | undefined,
    postedSince: Date | null,
    status: InteractionStatus | undefined,
  ): Promise<Prisma.JobWhereInput> {
    const criteriaWhere = await this.buildCriteriaWhere(queries, locations);
    if (postedSince && !status) criteriaWhere.datePosted = { gte: postedSince };
    if (!foundSearchId) return criteriaWhere;
    const searchLink: Prisma.JobWhereInput = {
      interactions: { some: { foundSearchId } },
    };
    const hasCriteria = queries.length > 0 || locations.length > 0;
    return hasCriteria ? { OR: [criteriaWhere, searchLink] } : searchLink;
  }

  async countMatchingSince(
    queries: string[],
    locations: string[],
    since: Date | null,
    postedSince: Date | null = null,
  ): Promise<number> {
    const where = await this.buildCriteriaWhere(queries, locations);
    if (since) where.scrapedAt = { gt: since };
    if (postedSince) where.datePosted = { gte: postedSince };
    return this.prisma.job.count({ where });
  }

  async findAll(query: FindJobsDto) {
    const where = await this.buildQueryLocationWhere(
      query.query,
      query.location,
    );
    if (query.source) where.source = query.source;
    if (query.company)
      where.company = { contains: query.company, mode: 'insensitive' };
    if (query.status) {
      where.interactions = { some: { status: query.status } };
    }

    return this.page(where, query.limit, query.offset);
  }

  async findByCriteria(
    queries: string[],
    locations: string[],
    limit: number,
    offset: number,
    postedSince: Date | null = null,
    opts: CriteriaFilterOptions = {},
  ) {
    const where = await this.scopedCriteriaWhere(
      queries,
      locations,
      opts.foundSearchId,
      postedSince,
      opts.status,
    );
    this.applyFilterOptions(where, opts, null);
    return this.page(where, limit, offset);
  }

  async findByAnyCriteria(
    criteria: { queries: string[]; locations: string[] }[],
    limit: number,
    offset: number,
    postedSince: Date | null = null,
    opts: Omit<CriteriaFilterOptions, 'foundSearchId'> = {},
  ) {
    if (criteria.length === 0) return { items: [], total: 0, limit, offset };
    const wheres = await Promise.all(
      criteria.map((c) => this.buildCriteriaWhere(c.queries, c.locations)),
    );
    const where: Prisma.JobWhereInput = { OR: wheres };
    this.applyFilterOptions(where, opts, postedSince);
    return this.page(where, limit, offset);
  }

  async newJobIdsSince(
    queries: string[],
    locations: string[],
    since: Date | null,
    postedSince: Date | null = null,
  ): Promise<string[]> {
    const where = await this.buildCriteriaWhere(queries, locations);
    if (since) where.scrapedAt = { gt: since };
    if (postedSince) where.datePosted = { gte: postedSince };
    const rows = await this.prisma.job.findMany({
      where,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private async page(
    where: Prisma.JobWhereInput,
    limit: number,
    offset: number,
  ) {
    const [rawItems, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { datePosted: 'desc' },
        take: limit,
        skip: offset,
        include: {
          establishment: true,
          score: true,
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    const items = rawItems.map(({ score, ...job }) => ({
      ...job,
      score: score?.score ?? 0,
    }));

    return { items, total, limit, offset };
  }

  async findKnownByExternalIds(
    source: JobSource,
    externalIds: string[],
  ): Promise<Map<string, KnownJob>> {
    if (externalIds.length === 0) return new Map();
    const rows = await this.prisma.job.findMany({
      where: { source, externalId: { in: externalIds } },
      select: { externalId: true, description: true, scrapedAt: true },
    });
    return new Map(
      rows.map((r) => [
        r.externalId,
        { description: r.description, scrapedAt: r.scrapedAt },
      ]),
    );
  }

  upsert(dto: CreateJobDto) {
    const { source, externalId, ...data } = dto;
    const update = data.description
      ? data
      : { ...data, description: undefined };
    return this.prisma.job.upsert({
      where: { source_externalId: { source, externalId } },
      create: { source, externalId, ...data },
      update,
    });
  }

  upsertMany(dtos: CreateJobDto[]) {
    return Promise.all(dtos.map((dto) => this.upsert(dto)));
  }

  async deleteAll(): Promise<number> {
    const { count } = await this.prisma.job.deleteMany({});
    return count;
  }
}
