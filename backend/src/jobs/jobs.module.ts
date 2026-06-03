import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ScraperService } from '../scraper/scraper.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, ScraperService],
  exports: [JobsService],
})
export class JobsModule {}
