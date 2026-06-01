import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { FindJobsQueryDto } from './dto/find-jobs-query.dto';
import type { Prisma } from '../../generated/prisma/client';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindJobsQueryDto) {
    const where: Prisma.JobWhereInput = {};
    if (query.source) where.source = query.source;
    if (query.company)
      where.company = { contains: query.company, mode: 'insensitive' };
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { datePosted: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.job.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
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
