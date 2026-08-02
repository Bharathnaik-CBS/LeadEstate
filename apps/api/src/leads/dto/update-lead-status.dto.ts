import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { LeadStatus } from '../../generated/prisma/client';

export class UpdateLeadStatusDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsUUID('all', { each: true })
  interestedProjectIds?: string[];
}
