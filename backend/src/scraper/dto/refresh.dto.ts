import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RefreshDto {
  @IsOptional()
  @IsString()
  query: string = '';

  @IsOptional()
  @IsString()
  location: string = '';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hard: boolean = true;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 20;
}
