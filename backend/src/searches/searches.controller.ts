import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SearchesService } from './searches.service';
import { FindJobsDto } from '../jobs/dto/find-jobs-query.dto';
import { CreateSearchDto } from './dto/create-search.dto';
import { UpdateSearchDto } from './dto/update-search.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller()
@UseGuards(JwtAuthGuard)
export class SearchesController {
  constructor(private readonly searchesService: SearchesService) {}

  @Get('searches')
  getSavedSearches(@CurrentUser() user: JwtPayload) {
    return this.searchesService.getSavedSearches(user.sub);
  }

  @Post('searches')
  createSavedSearch(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSearchDto,
  ) {
    return this.searchesService.createSavedSearch(user.sub, dto);
  }

  @Patch('searches/:id')
  updateSavedSearch(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSearchDto,
  ) {
    return this.searchesService.updateSavedSearch(user.sub, id, dto);
  }

  @Get('searches/:id/jobs')
  getJobsFor(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() query: FindJobsDto,
  ) {
    return this.searchesService.findJobsFor(
      user.sub,
      id,
      query.limit,
      query.offset,
    );
  }

  @Post('searches/:id/refresh')
  requestRefresh(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.searchesService
      .requestRefresh(user.sub, id)
      .then((state) => ({ state }));
  }

  @Post('searches/:id/seen')
  markSeen(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.searchesService.markSeen(user.sub, id);
  }

  @Delete('searches/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSavedSearch(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.searchesService.deleteSavedSearch(user.sub, id);
  }
}
