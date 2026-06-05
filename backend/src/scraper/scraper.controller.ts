import { Body, Controller, Post } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { FindJobsDto } from '../jobs/dto/find-jobs-query.dto';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post('/search')
  Search(@Body() query: FindJobsDto) {
    return this.scraperService.scrapeAllBoards(query);
  }
}
