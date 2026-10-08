import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { InteractionStatus } from '../../../generated/prisma/enums';

export class BulkSetInteractionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @ValidateIf((o: BulkSetInteractionsDto) => o.status !== null)
  @IsEnum(InteractionStatus)
  status!: InteractionStatus | null;

  @IsOptional()
  @IsString()
  searchId?: string;

  @IsOptional()
  @IsString()
  searchName?: string;
}
