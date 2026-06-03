import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { FindJobsQueryDto } from './dto/find-jobs-query.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  findAll(@Query() query: FindJobsQueryDto) {
    return this.jobsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Post()
  upsert(@Body() dto: CreateJobDto) {
    return this.jobsService.upsert(dto);
  }
}
