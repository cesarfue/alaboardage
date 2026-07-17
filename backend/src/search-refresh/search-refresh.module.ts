import { Module } from '@nestjs/common';
import { SearchRefreshService } from './search-refresh.service';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [ScraperModule],
  providers: [SearchRefreshService],
})
export class SearchRefreshModule {}
