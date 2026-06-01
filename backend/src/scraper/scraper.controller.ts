import { Body, Controller, Post } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ScrapeRequestDto } from './dto/scrape-request.dto';
import { RefreshDto } from './dto/refresh.dto';

@Controller('scrape')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post()
  scrape(@Body() dto: ScrapeRequestDto) {
    return this.scraperService.scrape(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.scraperService.refresh(dto);
  }
}
