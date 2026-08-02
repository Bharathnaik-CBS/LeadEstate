import { IsBoolean } from 'class-validator';

export class UpdateDriverStatusDto {
  @IsBoolean()
  isActive: boolean;
}
