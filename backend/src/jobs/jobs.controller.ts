import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { FindJobsDto } from './dto/find-jobs-query.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  findAll(@Query() query: FindJobsDto) {
    return this.jobsService.findAll(query);
  }

  @Post()
  upsert(@Body() dto: CreateJobDto) {
    return this.jobsService.upsert(dto);
  }
}
