import { Controller, MessageEvent, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ScraperService } from './scraper.service';
import { StreamSearchDto } from './dto/stream-search.dto';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Sse('/search')
  search(@Query() query: StreamSearchDto): Observable<MessageEvent> {
    return this.scraperService.scrapeAllBoardsStream(query);
  }
}
