import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingKycStatus } from '../../generated/prisma/client';

export class UpdateBookingKycDto {
  @IsOptional()
  @IsEnum(BookingKycStatus)
  status?: BookingKycStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
