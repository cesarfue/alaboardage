import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { InteractionStatus, JobSource } from '../../../generated/prisma/enums';

export class FindJobsDto {
  @IsOptional()
  @IsEnum(JobSource)
  source?: JobSource;

  @IsOptional()
  @IsEnum(InteractionStatus)
  status?: InteractionStatus;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  daysFilter?: number;
}
