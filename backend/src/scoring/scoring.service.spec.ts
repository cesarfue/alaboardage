// Mock heavy modules to keep this a pure unit test
jest.mock('../prisma/prisma.service');
jest.mock('../../generated/prisma/client', () => ({}));

import { ScoringService } from './scoring.service';
import { SkillLevel } from '../../generated/prisma/enums';

// Minimal Skill shape for tests — mirrors the Prisma type
interface Skill {
  id: string;
  userId: string;
  name: string;
  level: SkillLevel;
  createdAt: Date;
}

function makeSkill(name: string, level: SkillLevel): Skill {
  return {
    id: name,
    userId: 'default',
    name,
    level,
    createdAt: new Date(),
  };
}

describe('ScoringService.scoreJob', () => {
  let service: ScoringService;

  beforeEach(() => {
    // PrismaService not needed for unit tests of scoreJob
    service = new ScoringService(null as never);
  });

  it('gives 3 points per title occurrence for a PRIMARY skill', () => {
    const score = service.scoreJob(
      { title: 'TypeScript TypeScript developer', description: '' },
      [makeSkill('TypeScript', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(6); // 2 occurrences × 3
  });

  it('gives 1 point per description occurrence for a PRIMARY skill', () => {
    const score = service.scoreJob(
      { title: '', description: 'Experience with TypeScript and TypeScript.' },
      [makeSkill('TypeScript', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(2); // 2 occurrences × 1
  });

  it('gives 1.5 points per title occurrence for a SECONDARY skill', () => {
    const score = service.scoreJob(
      { title: 'React developer', description: '' },
      [makeSkill('React', SkillLevel.SECONDARY)],
    );
    expect(score).toBe(1.5);
  });

  it('gives 0.5 points per description occurrence for a SECONDARY skill', () => {
    const score = service.scoreJob(
      { title: '', description: 'Must know React' },
      [makeSkill('React', SkillLevel.SECONDARY)],
    );
    expect(score).toBe(0.5);
  });

  it('returns 0 when skill is absent', () => {
    const score = service.scoreJob(
      { title: 'Python developer', description: 'Python experience required' },
      [makeSkill('TypeScript', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(0);
  });

  it('sums correctly across multiple skills', () => {
    const score = service.scoreJob(
      {
        title: 'TypeScript React engineer',
        description: 'TypeScript experience',
      },
      [
        makeSkill('TypeScript', SkillLevel.PRIMARY), // title: 3, desc: 1 → 4
        makeSkill('React', SkillLevel.SECONDARY), // title: 1.5 → 1.5
      ],
    );
    expect(score).toBe(5.5);
  });

  it('matches case-insensitively', () => {
    const score = service.scoreJob(
      { title: 'TYPESCRIPT developer', description: '' },
      [makeSkill('typescript', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(3);
  });

  it('matches accented characters by normalizing both sides', () => {
    const score = service.scoreJob(
      { title: 'développeur senior', description: '' },
      [makeSkill('développeur', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(3);
  });

  it('does not match partial words (word boundary)', () => {
    const score = service.scoreJob(
      { title: 'TypeScriptExpert developer', description: '' },
      [makeSkill('TypeScript', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(0);
  });

  it('handles skills with special regex chars safely', () => {
    expect(() =>
      service.scoreJob({ title: 'C++ developer', description: '' }, [
        makeSkill('C++', SkillLevel.PRIMARY),
      ]),
    ).not.toThrow();
  });
});
