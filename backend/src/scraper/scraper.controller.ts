import {
  Controller,
  MessageEvent,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ScraperService } from './scraper.service';
import { FindJobsDto } from '../jobs/dto/find-jobs-query.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Sse('/search')
  @UseGuards(OptionalJwtAuthGuard)
  search(
    @Query() query: FindJobsDto,
    @CurrentUser() user: JwtPayload | undefined,
  ): Observable<MessageEvent> {
    const userId = user?.sub ?? 'default';
    return this.scraperService.scrapeAllBoardsStream(query, userId);
  }
}
