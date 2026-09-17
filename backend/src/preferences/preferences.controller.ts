import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('preferences')
@UseGuards(JwtAuthGuard)
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.preferencesService.get(user.sub);
  }

  @Patch()
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdatePreferencesDto) {
    return this.preferencesService.update(user.sub, dto);
  }
}
