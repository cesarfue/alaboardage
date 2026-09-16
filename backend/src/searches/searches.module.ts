import { Module } from '@nestjs/common';
import { SearchesController } from './searches.controller';
import { SearchesService } from './searches.service';
import { JobsModule } from '../jobs/jobs.module';
import { SearchRefreshModule } from '../search-refresh/search-refresh.module';

@Module({
  imports: [JobsModule, SearchRefreshModule],
  controllers: [SearchesController],
  providers: [SearchesService],
})
export class SearchesModule {}
