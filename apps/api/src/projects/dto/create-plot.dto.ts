import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { PlotStatus } from '../../generated/prisma/client';

export class CreatePlotDto {
  @IsString()
  @MinLength(1)
  plotNumber: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  facing?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(PlotStatus)
  status?: PlotStatus;
}
