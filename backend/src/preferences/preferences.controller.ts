import { Body, Controller, Get, Patch } from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  get() {
    return this.preferencesService.get();
  }

  @Patch()
  update(@Body() dto: UpdatePreferencesDto) {
    return this.preferencesService.update(dto);
  }
}
