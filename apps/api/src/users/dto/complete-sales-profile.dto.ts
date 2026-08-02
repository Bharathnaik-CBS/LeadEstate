import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Gender } from '../../generated/prisma/client';

export class CompleteSalesProfileDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  firstName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  lastName: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-z0-9._-]{3,32}$/, {
    message:
      'Username must be 3-32 characters and may only include letters, numbers, dots, underscores, or hyphens',
  })
  username: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(7)
  @MaxLength(16)
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'Phone number must be 7-15 digits and may start with +',
  })
  phoneNumber: string;

  @IsDateString()
  dob: string;

  @IsEnum(Gender)
  gender: Gender;
}
