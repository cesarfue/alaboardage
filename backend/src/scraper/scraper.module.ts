import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';

@Module({
  imports: [JobsModule],
  controllers: [ScraperController],
  providers: [ScraperService],
})
export class ScraperModule {}
