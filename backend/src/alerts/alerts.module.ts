import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { ScoringModule } from '../scoring/scoring.module';
import { SkillsModule } from '../skills/skills.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [ScoringModule, SkillsModule, JobsModule],
  providers: [AlertsService],
})
export class AlertsModule {}
