import { IsEnum } from 'class-validator';
import { InteractionStatus } from '../../../generated/prisma/enums';

export class SetInteractionDto {
  @IsEnum(InteractionStatus)
  status!: InteractionStatus;
}
