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
  UseGuards,
} from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { SetInteractionDto } from './dto/set-interaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller()
@UseGuards(JwtAuthGuard)
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Get('interactions')
  getInteractions(@CurrentUser() user: JwtPayload) {
    return this.interactionsService.getInteractions(user.sub);
  }

  @Put('jobs/:id/interaction')
  setInteraction(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetInteractionDto,
  ) {
    return this.interactionsService.upsertInteraction(user.sub, id, dto.status);
  }

  @Delete('jobs/:id/interaction')
  deleteInteraction(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.interactionsService.deleteInteraction(user.sub, id);
  }

  @Get('views')
  getViews(@CurrentUser() user: JwtPayload) {
    return this.interactionsService.getViewedJobIds(user.sub);
  }

  @Post('jobs/:id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markViewed(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.interactionsService.markViewed(user.sub, id);
  }
}
