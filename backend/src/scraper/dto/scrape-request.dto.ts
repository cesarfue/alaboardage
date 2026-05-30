import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JobSource } from '../../../generated/prisma/enums';

export class ScrapeRequestDto {
  @IsEnum(JobSource)
  source!: JobSource;

  @IsString()
  query!: string;

  @IsOptional()
  @IsString()
  location: string = '';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  offset: number = 1;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  singlePage: boolean = false;
}
