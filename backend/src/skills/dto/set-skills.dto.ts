import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { SkillLevel } from '../../../generated/prisma/enums';

export class SkillItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(SkillLevel)
  level!: SkillLevel;
}

export class SetSkillsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillItemDto)
  skills!: SkillItemDto[];
}
