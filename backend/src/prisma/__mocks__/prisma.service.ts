// Jest automatic mock for PrismaService — avoids loading @prisma/adapter-pg
export class PrismaService {
  skill = { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() };
  jobScore = { upsert: jest.fn() };
  job = {
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  };
}
