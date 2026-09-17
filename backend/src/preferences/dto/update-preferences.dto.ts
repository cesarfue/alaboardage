import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ListAnchorDto {
  @IsString()
  tab: string;

  @ValidateIf((o: ListAnchorDto) => o.jobId !== null)
  @IsString()
  jobId: string | null;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsObject()
  lastView?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => ListAnchorDto)
  anchor?: ListAnchorDto;
}
