import { IsBoolean } from 'class-validator';

export class UpdateVehicleStatusDto {
  @IsBoolean()
  isActive: boolean;
}
