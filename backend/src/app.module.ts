import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule } from './jobs/jobs.module';
import { ScraperModule } from './scraper/scraper.module';
import { EnrichmentModule } from './enrichment/enrichment.module';
import { SkillsModule } from './skills/skills.module';
import { InteractionsModule } from './interactions/interactions.module';
import { SearchesModule } from './searches/searches.module';
import { SearchRefreshModule } from './search-refresh/search-refresh.module';
import { PreferencesModule } from './preferences/preferences.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ScheduleModule.forRoot(),
    PrismaModule,
    JobsModule,
    ScraperModule,
    EnrichmentModule,
    SkillsModule,
    InteractionsModule,
    SearchesModule,
    SearchRefreshModule,
    PreferencesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
