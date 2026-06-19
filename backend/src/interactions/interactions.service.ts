import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InteractionStatus } from '../../generated/prisma/enums';

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  getInteractions(userId: string) {
    return this.prisma.jobInteraction.findMany({
      where: { userId },
      select: { jobId: true, status: true },
    });
  }

  upsertInteraction(userId: string, jobId: string, status: InteractionStatus) {
    return this.prisma.jobInteraction.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: { userId, jobId, status },
      update: { status },
    });
  }

  deleteInteraction(userId: string, jobId: string) {
    return this.prisma.jobInteraction.deleteMany({
      where: { userId, jobId },
    });
  }
}
