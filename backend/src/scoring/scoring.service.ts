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

const WORD_EDGE = /[a-z0-9_]/;

function skillPattern(normalizedName: string): string | null {
  if (normalizedName.length === 0) return null;
  const left = WORD_EDGE.test(normalizedName[0]) ? '\\b' : '';
  const right = WORD_EDGE.test(normalizedName[normalizedName.length - 1])
    ? '\\b'
    : '';
  return `${left}${escapeRegex(normalizedName)}${right}`;
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
    let hasTitleMatch = false;
    for (const skill of skills) {
      const pattern = skillPattern(normalize(skill.name));
      if (pattern === null) continue;
      const re = new RegExp(pattern, 'i');
      const inTitle = re.test(normTitle);
      const inDesc = re.test(normDesc);

      if (!inTitle && !inDesc) continue;
      total += skill.level === SkillLevel.PRIMARY ? 1 : 0.5;
      if (inTitle) hasTitleMatch = true;
    }
    if (hasTitleMatch) total += 0.5;

    return total;
  }

  async recomputeAll(): Promise<void> {
    const [skills, jobs] = await Promise.all([
      this.prisma.skill.findMany(),
      this.prisma.job.findMany({
        select: { id: true, title: true, description: true },
      }),
    ]);
    await this.prisma.jobScore.deleteMany();
    if (skills.length === 0) return;
    await this.prisma.jobScore.createMany({
      data: jobs.map((job) => ({
        jobId: job.id,
        score: this.scoreJob(job, skills),
      })),
    });
  }

  async computeAndSave(job: Job): Promise<void> {
    const skills = await this.prisma.skill.findMany();
    if (skills.length === 0) return;

    const score = this.scoreJob(job, skills);

    await this.prisma.jobScore.upsert({
      where: { jobId: job.id },
      create: { jobId: job.id, score },
      update: { score },
    });
  }
}
