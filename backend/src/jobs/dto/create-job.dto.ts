import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { JobSource } from '../../../generated/prisma/enums';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @IsEnum(JobSource)
  source!: JobSource;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  company!: string;

  @IsString()
  location!: string;

  @IsString()
  description!: string;

  @IsUrl()
  url!: string;

  @Type(() => Date)
  @IsDate()
  datePosted!: Date;
}
