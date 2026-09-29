import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ListAnchorDto {
  @IsString()
  tab!: string;

  @ValidateIf((o: ListAnchorDto) => o.jobId !== null)
  @IsString()
  jobId!: string | null;
}

export class FiltersDto {
  @IsNumber()
  radiusKm!: number;

  @ValidateIf((o: FiltersDto) => o.daysFilter !== null)
  @IsNumber()
  daysFilter!: number | null;

  @IsBoolean()
  hideViewed!: boolean;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsObject()
  lastView?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => ListAnchorDto)
  anchor?: ListAnchorDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FiltersDto)
  filters?: FiltersDto;
}
