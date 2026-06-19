import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { SetSkillsDto } from './dto/set-skills.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('skills')
@UseGuards(JwtAuthGuard)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  getSkills(@CurrentUser() user: JwtPayload) {
    return this.skillsService.getSkills(user.sub);
  }

  @Put()
  setSkills(@CurrentUser() user: JwtPayload, @Body() dto: SetSkillsDto) {
    return this.skillsService.setSkills(user.sub, dto.skills);
  }
}
