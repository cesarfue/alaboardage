import { Body, Controller, Post } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { FindJobsQueryDto } from '../jobs/dto/find-jobs-query.dto';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post('/search')
  Search(@Body() query: FindJobsQueryDto) {
    return this.scraperService.scrapeAllBoards(query);
  }
}
