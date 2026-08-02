import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelPlotBlockDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationReason?: string;
}
