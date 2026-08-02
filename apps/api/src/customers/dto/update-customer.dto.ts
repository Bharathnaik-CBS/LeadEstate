import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { CustomerJourneyStatus } from '../../generated/prisma/client';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(CustomerJourneyStatus)
  status?: CustomerJourneyStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  sourceLeadId?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}
