import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { BookingType } from '../../generated/prisma/client';

export class CreateBookingDto {
  @IsString()
  @IsUUID()
  leadId: string;

  @IsString()
  @IsUUID()
  projectId: string;

  @IsString()
  @IsUUID()
  plotId: string;

  @IsEnum(BookingType)
  type: BookingType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountPaid?: number;

  @IsOptional()
  @IsDateString()
  bookingDate?: string;
}
