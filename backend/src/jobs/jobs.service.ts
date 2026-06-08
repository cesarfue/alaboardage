import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { FindJobsDto } from './dto/find-jobs-query.dto';
import type { Prisma } from '../../generated/prisma/client';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindJobsDto) {
    const where: Prisma.JobWhereInput = {};
    if (query.source) where.source = query.source;
    if (query.company) where.company = { contains: query.company };
    if (query.location) where.location = { contains: query.location };
    if (query.query) {
      const words = query.query.trim().split(/\s+/);
      where.AND = words.map((word) => ({ title: { contains: word } }));
    }

    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { datePosted: 'desc' },
        take: query.limit,
        skip: query.offset,
        include: { establishment: true },
      }),
      this.prisma.job.count({ where }),
    ]);

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
    return this.prisma.$transaction(dtos.map((dto) => this.upsertQuery(dto)));
  }

  async deleteAll(): Promise<number> {
    const { count } = await this.prisma.job.deleteMany({});
    return count;
  }

  private upsertQuery(dto: CreateJobDto) {
    const { source, externalId, ...data } = dto;
    return this.prisma.job.upsert({
      where: { source_externalId: { source, externalId } },
      create: { source, externalId, ...data },
      update: data,
    });
  }
}
