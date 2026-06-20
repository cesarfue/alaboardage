import { Body, Controller, Get, Logger, Put, UseGuards } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { SetSkillsDto } from './dto/set-skills.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ScoringService } from '../scoring/scoring.service';

@Controller('skills')
@UseGuards(JwtAuthGuard)
export class SkillsController {
  private readonly logger = new Logger(SkillsController.name);

  constructor(
    private readonly skillsService: SkillsService,
    private readonly scoringService: ScoringService,
  ) {}

  @Get()
  getSkills(@CurrentUser() user: JwtPayload) {
    return this.skillsService.getSkills(user.sub);
  }

  @Put()
  async setSkills(@CurrentUser() user: JwtPayload, @Body() dto: SetSkillsDto) {
    const result = await this.skillsService.setSkills(user.sub, dto.skills);
    void this.scoringService
      .recomputeAll(user.sub)
      .catch((e: Error) =>
        this.logger.error(`recomputeAll failed for ${user.sub}: ${e.message}`),
      );
    return result;
  }
}
