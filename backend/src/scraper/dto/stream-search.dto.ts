import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string') return value.length > 0 ? [value] : [];
  return [];
}

export class StreamSearchDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toArray(value))
  query: string[] = [];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toArray(value))
  location: string[] = [];
}
