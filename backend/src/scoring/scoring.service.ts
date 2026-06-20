import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Job, Skill } from '../../generated/prisma/client';
import { SkillLevel } from '../../generated/prisma/enums';

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  scoreJob(
    job: { title: string; description: string },
    skills: Skill[],
  ): number {
    const normTitle = normalize(job.title);
    const normDesc = normalize(job.description);

    let total = 0;
    for (const skill of skills) {
      const pattern = `\\b${escapeRegex(normalize(skill.name))}\\b`;
      const re = new RegExp(pattern, 'gi');

      const inTitle = re.test(normTitle) ? 1 : 0;
      re.lastIndex = 0; // reset car le regex a le flag 'g'
      const inDesc = re.test(normDesc) ? 1 : 0;
      re.lastIndex = 0;

      if (skill.level === SkillLevel.PRIMARY) {
        total += inTitle * 3 + inDesc * 1;
      } else {
        total += inTitle * 1.5 + inDesc * 0.5;
      }
    }

    return total;
  }

  async recomputeAll(userId: string): Promise<void> {
    const [skills, jobs] = await Promise.all([
      this.prisma.skill.findMany({ where: { userId } }),
      this.prisma.job.findMany({ select: { id: true, title: true, description: true } }),
    ]);
    await this.prisma.jobScore.deleteMany({ where: { userId } });
    if (skills.length === 0) return;
    await this.prisma.jobScore.createMany({
      data: jobs.map((job) => ({
        jobId: job.id,
        userId,
        score: this.scoreJob(job, skills),
      })),
    });
  }

  async computeAndSave(job: Job, userId: string): Promise<void> {
    const skills = await this.prisma.skill.findMany({ where: { userId } });
    if (skills.length === 0) return;

    const score = this.scoreJob(job, skills);

    await this.prisma.jobScore.upsert({
      where: { jobId_userId: { jobId: job.id, userId } },
      create: { jobId: job.id, userId, score },
      update: { score },
    });
  }
}
