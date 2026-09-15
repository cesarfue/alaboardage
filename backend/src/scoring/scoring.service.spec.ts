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

  it('PRIMARY in title = 1 (skill) + 0.5 (title bonus) = 1.5', () => {
    const score = service.scoreJob(
      { title: 'TypeScript developer', description: '' },
      [makeSkill('TypeScript', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(1.5);
  });

  it('repeated PRIMARY in title counts once', () => {
    const score = service.scoreJob(
      { title: 'TypeScript TypeScript developer', description: '' },
      [makeSkill('TypeScript', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(1.5);
  });

  it('PRIMARY in description only = 1 (no title bonus)', () => {
    const score = service.scoreJob(
      { title: '', description: 'Experience with TypeScript and TypeScript.' },
      [makeSkill('TypeScript', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(1);
  });

  it('SECONDARY in title = 0.5 + 0.5 = 1', () => {
    const score = service.scoreJob(
      { title: 'React developer', description: '' },
      [makeSkill('React', SkillLevel.SECONDARY)],
    );
    expect(score).toBe(1);
  });

  it('SECONDARY in description only = 0.5', () => {
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

  it('breadth beats depth: 3 skills in desc > 1 skill in title', () => {
    const skills = [
      makeSkill('terraform', SkillLevel.PRIMARY),
      makeSkill('ansible', SkillLevel.PRIMARY),
      makeSkill('sql', SkillLevel.PRIMARY),
    ];
    const wideMatch = service.scoreJob(
      { title: 'DevOps engineer', description: 'terraform ansible sql' },
      skills,
    );
    const titleOnly = service.scoreJob(
      { title: 'Ansible engineer', description: '' },
      skills,
    );
    expect(wideMatch).toBe(3); // 3 primary in desc, no title match
    expect(titleOnly).toBe(1.5); // 1 primary in title + bonus
    expect(wideMatch).toBeGreaterThan(titleOnly);
  });

  it('sums correctly across multiple skills with title bonus applied once', () => {
    const score = service.scoreJob(
      {
        title: 'TypeScript React engineer',
        description: 'TypeScript experience',
      },
      [
        makeSkill('TypeScript', SkillLevel.PRIMARY),
        makeSkill('React', SkillLevel.SECONDARY),
      ],
    );
    expect(score).toBe(2);
  });

  it('matches case-insensitively', () => {
    const score = service.scoreJob(
      { title: 'TYPESCRIPT developer', description: '' },
      [makeSkill('typescript', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(1.5);
  });

  it('matches accented characters by normalizing both sides', () => {
    const score = service.scoreJob(
      { title: 'développeur senior', description: '' },
      [makeSkill('développeur', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(1.5);
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

  it.each([
    ['C++', 'Développeur C++ senior'],
    ['C#', 'Développeur C# senior'],
    ['.NET', 'Développeur .NET senior'],
  ])('scores %s when it appears in the title', (skill, title) => {
    const score = service.scoreJob({ title, description: '' }, [
      makeSkill(skill, SkillLevel.PRIMARY),
    ]);
    expect(score).toBe(1.5);
  });

  it('matches .NET inside ASP.NET', () => {
    const score = service.scoreJob(
      { title: 'Développeur ASP.NET', description: '' },
      [makeSkill('.NET', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(1.5);
  });

  it('does not match .NET inside a longer word', () => {
    const score = service.scoreJob(
      { title: 'Ingénieur socket.network', description: '' },
      [makeSkill('.NET', SkillLevel.PRIMARY)],
    );
    expect(score).toBe(0);
  });
});
