import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { LeadSource } from '../../generated/prisma/client';

export class AdminDashboardQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  selectedDate?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsUUID()
  platformId?: string;
}
