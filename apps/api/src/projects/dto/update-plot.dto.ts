import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePlotDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  plotNumber?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  facing?: string;
}
