import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { FindJobsDto } from './dto/find-jobs-query.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(
    @Query() query: FindJobsDto,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    const userId = user?.sub ?? 'default';
    return this.jobsService.findAll(query, userId);
  }

  @Post()
  upsert(@Body() dto: CreateJobDto) {
    return this.jobsService.upsert(dto);
  }
}
