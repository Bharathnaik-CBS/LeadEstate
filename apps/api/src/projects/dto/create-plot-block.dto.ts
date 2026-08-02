import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreatePlotBlockDto {
  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
