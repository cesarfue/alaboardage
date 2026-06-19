import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Skill } from '../../generated/prisma/client';
import { SkillLevel } from '../../generated/prisma/enums';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  getSkills(userId: string): Promise<Skill[]> {
    return this.prisma.skill.findMany({ where: { userId } });
  }

  async setSkills(
    userId: string,
    skills: { name: string; level: SkillLevel }[],
  ): Promise<Skill[]> {
    await this.prisma.$transaction([
      this.prisma.skill.deleteMany({ where: { userId } }),
      this.prisma.skill.createMany({
        data: skills.map((s) => ({ ...s, userId })),
      }),
    ]);
    return this.prisma.skill.findMany({ where: { userId } });
  }
}
