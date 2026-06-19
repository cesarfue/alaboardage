import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require('@prisma/adapter-pg') as {
  PrismaPg: new (cfg: { connectionString: string | undefined }) => unknown;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
    await this.$executeRaw`CREATE EXTENSION IF NOT EXISTS unaccent`;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
