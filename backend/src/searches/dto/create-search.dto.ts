import { IsString } from 'class-validator';

export class CreateSearchDto {
  @IsString()
  name!: string;

  @IsString()
  query!: string;

  @IsString()
  location!: string;
}
