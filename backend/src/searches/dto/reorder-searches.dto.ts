import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderSearchesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];
}
