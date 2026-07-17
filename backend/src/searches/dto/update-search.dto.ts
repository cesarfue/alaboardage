import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSearchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  emailAlerts?: boolean;
}
