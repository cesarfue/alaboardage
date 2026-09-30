import { Body, Controller, Get, Logger, Put } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { SetSkillsDto } from './dto/set-skills.dto';
import { ScoringService } from '../scoring/scoring.service';

@Controller('skills')
export class SkillsController {
  private readonly logger = new Logger(SkillsController.name);

  constructor(
    private readonly skillsService: SkillsService,
    private readonly scoringService: ScoringService,
  ) {}

  @Get()
  getSkills() {
    return this.skillsService.getSkills();
  }

  @Put()
  async setSkills(@Body() dto: SetSkillsDto) {
    const result = await this.skillsService.setSkills(dto.skills);
    void this.scoringService
      .recomputeAll()
      .catch((e: Error) =>
        this.logger.error(`recomputeAll failed: ${e.message}`),
      );
    return result;
  }
}
