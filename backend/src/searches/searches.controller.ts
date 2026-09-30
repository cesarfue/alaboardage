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
  Put,
  Query,
} from '@nestjs/common';
import { SearchesService } from './searches.service';
import { FindJobsDto } from '../jobs/dto/find-jobs-query.dto';
import { CreateSearchDto } from './dto/create-search.dto';
import { UpdateSearchDto } from './dto/update-search.dto';
import { ReorderSearchesDto } from './dto/reorder-searches.dto';

@Controller()
export class SearchesController {
  constructor(private readonly searchesService: SearchesService) {}

  @Get('searches')
  getSavedSearches(@Query() query: FindJobsDto) {
    return this.searchesService.getSavedSearches(query.daysFilter ?? null);
  }

  @Post('searches')
  createSavedSearch(@Body() dto: CreateSearchDto) {
    return this.searchesService.createSavedSearch(dto);
  }

  @Put('searches/order')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(@Body() dto: ReorderSearchesDto) {
    return this.searchesService.reorder(dto.ids);
  }

  @Patch('searches/:id')
  updateSavedSearch(@Param('id') id: string, @Body() dto: UpdateSearchDto) {
    return this.searchesService.updateSavedSearch(id, dto);
  }

  @Get('feed')
  feed(@Query() query: FindJobsDto) {
    return this.searchesService.feed(
      query.limit,
      query.offset,
      query.daysFilter ?? null,
    );
  }

  @Post('feed/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllSeen() {
    return this.searchesService.markAllSeen();
  }

  @Post('feed/refresh')
  requestRefreshAll() {
    return this.searchesService
      .requestRefreshAll()
      .then((states) => ({ states }));
  }

  @Get('searches/:id/jobs')
  getJobsFor(@Param('id') id: string, @Query() query: FindJobsDto) {
    return this.searchesService.findJobsFor(id, query.limit, query.offset);
  }

  @Post('searches/:id/refresh')
  requestRefresh(@Param('id') id: string) {
    return this.searchesService.requestRefresh(id).then((state) => ({ state }));
  }

  @Post('searches/:id/seen')
  markSeen(@Param('id') id: string) {
    return this.searchesService.markSeen(id);
  }

  @Delete('searches/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSavedSearch(@Param('id') id: string) {
    return this.searchesService.deleteSavedSearch(id);
  }
}
