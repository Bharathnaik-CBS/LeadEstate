import { IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordWithOtpDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: 'OTP must be exactly 6 numeric digits',
  })
  otp: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'New password must include uppercase, lowercase, number, and special character',
  })
  newPassword: string;
}
