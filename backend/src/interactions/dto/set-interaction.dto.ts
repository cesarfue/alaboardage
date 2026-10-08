import { IsEnum, IsOptional, IsString } from 'class-validator';
import { InteractionStatus } from '../../../generated/prisma/enums';

export class SetInteractionDto {
  @IsEnum(InteractionStatus)
  status!: InteractionStatus;

  @IsOptional()
  @IsString()
  searchId?: string;

  @IsOptional()
  @IsString()
  searchName?: string;
}
