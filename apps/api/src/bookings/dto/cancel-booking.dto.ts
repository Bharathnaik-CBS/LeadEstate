import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelBookingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  cancellationReason: string;
}
