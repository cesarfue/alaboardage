import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Job, Skill } from '../../generated/prisma/client';
import { SkillLevel } from '../../generated/prisma/enums';

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
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

      const titleHits = (normTitle.match(re) ?? []).length;
      const descHits = (normDesc.match(re) ?? []).length;

      if (skill.level === SkillLevel.PRIMARY) {
        total += titleHits * 3 + descHits * 1;
      } else {
        total += titleHits * 1.5 + descHits * 0.5;
      }
    }

    return total;
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
