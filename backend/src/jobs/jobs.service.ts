import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { FindJobsDto } from './dto/find-jobs-query.dto';
import type { Prisma } from '../../generated/prisma/client';

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
    const where: Prisma.JobWhereInput = {};
    if (location)
      where.location = { contains: location, mode: 'insensitive' };
    if (query) {
      const words = query.trim().split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        // SQL structure built from word count (not user input) — values are parameterized
        const conditions = words
          .map((_, i) => `unaccent(title) ILIKE unaccent($${i + 1})`)
          .join(' AND ');
        const rows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "Job" WHERE ${conditions}`,
          ...words.map((w) => `%${w}%`),
        );
        where.id = { in: rows.map((r) => r.id) };
      }
    }
    return where;
  }

  /**
   * Count jobs matching (query, location) scraped strictly after `since`.
   * Used by SavedSearch to compute `newResultsCount`.
   */
  async countMatchingSince(
    query: string | undefined,
    location: string | undefined,
    since: Date | null,
  ): Promise<number> {
    const where = await this.buildQueryLocationWhere(query, location);
    if (since) where.scrapedAt = { gt: since };
    return this.prisma.job.count({ where });
  }

  async findAll(query: FindJobsDto, userId: string) {
    const where = await this.buildQueryLocationWhere(query.query, query.location);
    if (query.source) where.source = query.source;
    if (query.company)
      where.company = { contains: query.company, mode: 'insensitive' };

    const [rawItems, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { datePosted: 'desc' },
        take: query.limit,
        skip: query.offset,
        include: {
          establishment: true,
          scores: { where: { userId } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    const items = rawItems.map(({ scores, ...job }) => ({
      ...job,
      score: scores[0]?.score ?? 0,
    }));

    return { items, total, limit: query.limit, offset: query.offset };
  }

  upsert(dto: CreateJobDto) {
    const { source, externalId, ...data } = dto;
    return this.prisma.job.upsert({
      where: { source_externalId: { source, externalId } },
      create: { source, externalId, ...data },
      update: data,
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
