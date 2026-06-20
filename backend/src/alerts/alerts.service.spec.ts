// Mock schedule decorators to avoid metadata setup in unit tests
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
}));
// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({}),
  }),
}));
// Mock Prisma generated client (prevents PrismaClient constructor from running)
jest.mock('../../generated/prisma/client', () => ({}));
// Mock PrismaService to avoid database connections
jest.mock('../prisma/prisma.service');

import { AlertsService } from './alerts.service';
import { ScoringService } from '../scoring/scoring.service';
import { SkillsService } from '../skills/skills.service';
import { SkillLevel } from '../../generated/prisma/enums';
import type {
  Skill,
  Job,
  SavedSearch,
  User,
} from '../../generated/prisma/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(name: string, level: SkillLevel): Skill {
  return { id: name, userId: 'user-1', name, level, createdAt: new Date() };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    externalId: 'ext-1',
    source: 'LINKEDIN',
    title: 'TypeScript Developer',
    company: 'ACME',
    location: 'Paris',
    description: 'We need TypeScript skills',
    url: 'https://example.com/job/1',
    datePosted: new Date(),
    scrapedAt: new Date(),
    updatedAt: new Date(),
    establishmentId: null,
    ...overrides,
  };
}

function makeSearch(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    userId: 'user-1',
    name: 'TS jobs',
    query: 'TypeScript',
    location: 'Paris',
    createdAt: new Date(),
    lastAlertAt: null,
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    googleId: 'g-1',
    email: 'test@example.com',
    name: 'Test User',
    picture: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AlertsService.runAlerts', () => {
  let service: AlertsService;
  let prismaMock: any;
  let scoringService: ScoringService;
  let skillsService: SkillsService;

  beforeEach(() => {
    prismaMock = {
      savedSearch: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn(),
      },
      job: {
        findMany: jest.fn(),
      },
    };

    scoringService = new ScoringService(null as never);
    skillsService = { getSkills: jest.fn() } as any;

    service = new AlertsService(prismaMock, scoringService, skillsService);
  });

  it('does nothing when no saved searches', async () => {
    prismaMock.savedSearch.findMany.mockResolvedValue([]);
    await service.runAlerts();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('skips users with no skills', async () => {
    prismaMock.savedSearch.findMany.mockResolvedValue([makeSearch()]);
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    (skillsService.getSkills as jest.Mock).mockResolvedValue([]);

    await service.runAlerts();

    expect(prismaMock.job.findMany).not.toHaveBeenCalled();
    expect(prismaMock.savedSearch.updateMany).not.toHaveBeenCalled();
  });

  it('does not update lastAlertAt when no jobs match (score == 0)', async () => {
    const search = makeSearch();
    prismaMock.savedSearch.findMany.mockResolvedValue([search]);
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    (skillsService.getSkills as jest.Mock).mockResolvedValue([
      makeSkill('Python', SkillLevel.PRIMARY),
    ]);
    // Job does not mention Python
    prismaMock.job.findMany.mockResolvedValue([
      makeJob({ title: 'Ruby dev', description: 'Ruby' }),
    ]);

    await service.runAlerts();

    expect(prismaMock.savedSearch.updateMany).not.toHaveBeenCalled();
  });

  it('updates lastAlertAt for both searches when both have matching jobs in their window', async () => {
    const search1 = makeSearch({ id: 'search-1', name: 'TS jobs' });
    const search2 = makeSearch({ id: 'search-2', name: 'Another search' });
    prismaMock.savedSearch.findMany.mockResolvedValue([search1, search2]);
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    (skillsService.getSkills as jest.Mock).mockResolvedValue([
      makeSkill('TypeScript', SkillLevel.PRIMARY),
    ]);
    // Job matches TypeScript — both searches see it since both have null lastAlertAt
    prismaMock.job.findMany.mockResolvedValue([makeJob()]);

    await service.runAlerts();

    const call = prismaMock.savedSearch.updateMany.mock.calls[0][0];
    expect(call.where.id.in).toContain('search-1');
    expect(call.where.id.in).toContain('search-2');
  });

  it('keeps only top-10 jobs per search sorted by score desc', async () => {
    const search = makeSearch();
    prismaMock.savedSearch.findMany.mockResolvedValue([search]);
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    (skillsService.getSkills as jest.Mock).mockResolvedValue([
      makeSkill('TypeScript', SkillLevel.PRIMARY),
    ]);

    // Create 15 matching jobs
    const jobs = Array.from({ length: 15 }, (_, i) =>
      makeJob({
        id: `job-${i}`,
        externalId: `ext-${i}`,
        title: 'TypeScript dev',
      }),
    );
    prismaMock.job.findMany.mockResolvedValue(jobs);

    // Capture what actually gets emitted (we're in dry-run mode — no SMTP_HOST)
    const loggedLines: string[] = [];
    jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation((msg: string) => {
        loggedLines.push(msg);
      });

    await service.runAlerts();

    // lastAlertAt should have been updated
    expect(prismaMock.savedSearch.updateMany).toHaveBeenCalled();

    // The logger should have logged exactly 10 job lines (prefixed with score)
    const jobLines = loggedLines.filter((l) => l.includes('[score='));
    expect(jobLines).toHaveLength(10);
  });

  it('does not update lastAlertAt for a search whose window contains no new jobs', async () => {
    // search-A has no lastAlertAt (uses 25h fallback) → job is in window
    // search-B has a future lastAlertAt → job is NOT in its window
    const searchA = makeSearch({ id: 'A', name: 'Active search' });
    const futureDate = new Date(Date.now() + 60 * 1000); // 1 minute in the future
    const searchB = makeSearch({
      id: 'B',
      name: 'Future search',
      lastAlertAt: futureDate,
    });

    prismaMock.savedSearch.findMany.mockResolvedValue([searchA, searchB]);
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    (skillsService.getSkills as jest.Mock).mockResolvedValue([
      makeSkill('TypeScript', SkillLevel.PRIMARY),
    ]);
    // Job was scraped now — before search-B's future lastAlertAt threshold
    prismaMock.job.findMany.mockResolvedValue([
      makeJob({ scrapedAt: new Date() }),
    ]);

    await service.runAlerts();

    const call = prismaMock.savedSearch.updateMany.mock.calls[0][0];
    expect(call.where.id.in).toEqual(['A']);
    expect(call.where.id.in).not.toContain('B');
  });
});
