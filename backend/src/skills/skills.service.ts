import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Skill } from '../../generated/prisma/client';
import { SkillLevel } from '../../generated/prisma/enums';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  getSkills(): Promise<Skill[]> {
    return this.prisma.skill.findMany();
  }

  async setSkills(
    skills: { name: string; level: SkillLevel }[],
  ): Promise<Skill[]> {
    await this.prisma.$transaction([
      this.prisma.skill.deleteMany(),
      this.prisma.skill.createMany({ data: skills }),
    ]);
    return this.prisma.skill.findMany();
  }
}
