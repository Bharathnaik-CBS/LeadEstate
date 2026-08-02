import { IsEnum } from 'class-validator';
import { PlotStatus } from '../../generated/prisma/client';

export class UpdatePlotStatusDto {
  @IsEnum(PlotStatus)
  status: PlotStatus;
}
