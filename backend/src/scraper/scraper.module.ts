import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { JobsModule } from '../jobs/jobs.module';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [JobsModule, EnrichmentModule, ScoringModule],
  controllers: [ScraperController],
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule {}
