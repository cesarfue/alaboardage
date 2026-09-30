import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateSearchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  queries?: string[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  locations?: string[];
}
