import { ArrayNotEmpty, IsArray, IsBoolean, IsString } from 'class-validator';

export class BulkSetViewedDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsBoolean()
  viewed!: boolean;
}
