import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SearchesService } from './searches.service';
import { CreateSearchDto } from './dto/create-search.dto';
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

  @Delete('searches/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSavedSearch(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.searchesService.deleteSavedSearch(user.sub, id);
  }
}
