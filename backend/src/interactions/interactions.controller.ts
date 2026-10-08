import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { SetInteractionDto } from './dto/set-interaction.dto';
import { BulkSetInteractionsDto } from './dto/bulk-set-interactions.dto';
import { BulkSetViewedDto } from './dto/bulk-set-viewed.dto';

@Controller()
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Get('interactions')
  getInteractions() {
    return this.interactionsService.getInteractions();
  }

  @Put('jobs/:id/interaction')
  setInteraction(@Param('id') id: string, @Body() dto: SetInteractionDto) {
    return this.interactionsService.upsertInteraction(
      id,
      dto.status,
      dto.searchId,
      dto.searchName,
    );
  }

  @Delete('jobs/:id/interaction')
  deleteInteraction(@Param('id') id: string) {
    return this.interactionsService.deleteInteraction(id);
  }

  @Put('interactions/bulk')
  @HttpCode(HttpStatus.NO_CONTENT)
  async bulkSetInteractions(@Body() dto: BulkSetInteractionsDto) {
    await this.interactionsService.bulkSetInteractions(
      dto.ids,
      dto.status,
      dto.searchId,
      dto.searchName,
    );
  }

  @Get('views')
  getViews() {
    return this.interactionsService.getViewedJobIds();
  }

  @Post('jobs/:id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markViewed(@Param('id') id: string) {
    await this.interactionsService.markViewed(id);
  }

  @Post('views/bulk')
  @HttpCode(HttpStatus.NO_CONTENT)
  async bulkSetViewed(@Body() dto: BulkSetViewedDto) {
    await this.interactionsService.bulkSetViewed(dto.ids, dto.viewed);
  }
}
