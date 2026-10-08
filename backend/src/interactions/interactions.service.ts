import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InteractionStatus } from '../../generated/prisma/enums';

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  getInteractions() {
    return this.prisma.jobInteraction.findMany({
      select: { jobId: true, status: true, updatedAt: true },
    });
  }

  upsertInteraction(
    jobId: string,
    status: InteractionStatus,
    searchId?: string,
    searchName?: string,
  ) {
    return this.prisma.jobInteraction.upsert({
      where: { jobId },
      create: {
        jobId,
        status,
        foundSearchId: searchId,
        foundSearchName: searchName,
      },
      update: { status },
    });
  }

  deleteInteraction(jobId: string) {
    return this.prisma.jobInteraction.deleteMany({
      where: { jobId },
    });
  }

  async bulkSetInteractions(
    ids: string[],
    status: InteractionStatus | null,
    searchId?: string,
    searchName?: string,
  ): Promise<void> {
    if (status === null) {
      await this.prisma.jobInteraction.deleteMany({
        where: { jobId: { in: ids } },
      });
      return;
    }
    await this.prisma.$transaction(
      ids.map((jobId) =>
        this.prisma.jobInteraction.upsert({
          where: { jobId },
          create: {
            jobId,
            status,
            foundSearchId: searchId,
            foundSearchName: searchName,
          },
          update: { status },
        }),
      ),
    );
  }

  markViewed(jobId: string) {
    return this.prisma.jobView.upsert({
      where: { jobId },
      create: { jobId },
      update: {},
    });
  }

  async bulkSetViewed(ids: string[], viewed: boolean): Promise<void> {
    if (!viewed) {
      await this.prisma.jobView.deleteMany({ where: { jobId: { in: ids } } });
      return;
    }
    await this.prisma.$transaction(
      ids.map((jobId) =>
        this.prisma.jobView.upsert({
          where: { jobId },
          create: { jobId },
          update: {},
        }),
      ),
    );
  }

  async getViewedJobIds(): Promise<string[]> {
    const rows = await this.prisma.jobView.findMany({
      select: { jobId: true },
    });
    return rows.map((r) => r.jobId);
  }
}
