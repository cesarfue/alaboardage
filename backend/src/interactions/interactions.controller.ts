import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { SetInteractionDto } from './dto/set-interaction.dto';

@Controller()
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Get('interactions')
  getInteractions() {
    return this.interactionsService.getInteractions('default');
  }

  @Put('jobs/:id/interaction')
  setInteraction(@Param('id') id: string, @Body() dto: SetInteractionDto) {
    return this.interactionsService.upsertInteraction(
      'default',
      id,
      dto.status,
    );
  }

  @Delete('jobs/:id/interaction')
  deleteInteraction(@Param('id') id: string) {
    return this.interactionsService.deleteInteraction('default', id);
  }
}
