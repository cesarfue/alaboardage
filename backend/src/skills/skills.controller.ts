import { Body, Controller, Get, Put } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { SetSkillsDto } from './dto/set-skills.dto';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  getSkills() {
    return this.skillsService.getSkills('default');
  }

  @Put()
  setSkills(@Body() dto: SetSkillsDto) {
    return this.skillsService.setSkills('default', dto.skills);
  }
}
