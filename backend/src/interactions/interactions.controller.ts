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

@Controller()
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Get('interactions')
  getInteractions() {
    return this.interactionsService.getInteractions();
  }

  @Put('jobs/:id/interaction')
  setInteraction(@Param('id') id: string, @Body() dto: SetInteractionDto) {
    return this.interactionsService.upsertInteraction(id, dto.status);
  }

  @Delete('jobs/:id/interaction')
  deleteInteraction(@Param('id') id: string) {
    return this.interactionsService.deleteInteraction(id);
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
}
