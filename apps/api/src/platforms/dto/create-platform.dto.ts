import { IsString } from 'class-validator';

export class CreatePlatformDto {
  @IsString()
  name: string;
}
