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

  upsertInteraction(jobId: string, status: InteractionStatus) {
    return this.prisma.jobInteraction.upsert({
      where: { jobId },
      create: { jobId, status },
      update: { status },
    });
  }

  deleteInteraction(jobId: string) {
    return this.prisma.jobInteraction.deleteMany({
      where: { jobId },
    });
  }

  markViewed(jobId: string) {
    return this.prisma.jobView.upsert({
      where: { jobId },
      create: { jobId },
      update: {},
    });
  }

  async getViewedJobIds(): Promise<string[]> {
    const rows = await this.prisma.jobView.findMany({
      select: { jobId: true },
    });
    return rows.map((r) => r.jobId);
  }
}
