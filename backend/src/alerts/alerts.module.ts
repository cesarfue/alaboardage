import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { ScoringModule } from '../scoring/scoring.module';
import { SkillsModule } from '../skills/skills.module';

@Module({
  imports: [ScoringModule, SkillsModule],
  providers: [AlertsService],
})
export class AlertsModule {}
