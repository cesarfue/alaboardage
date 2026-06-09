import { Controller, MessageEvent, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ScraperService } from './scraper.service';
import { FindJobsDto } from '../jobs/dto/find-jobs-query.dto';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Sse('/search')
  search(@Query() query: FindJobsDto): Observable<MessageEvent> {
    return this.scraperService.scrapeAllBoardsStream(query);
  }
}
