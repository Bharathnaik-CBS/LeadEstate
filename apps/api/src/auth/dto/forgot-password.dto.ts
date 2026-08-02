import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class ForgotPasswordDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  identifier: string;
}
