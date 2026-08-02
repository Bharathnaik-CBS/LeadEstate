import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @Permissions(PERMISSIONS.VEHICLES.CREATE)
  create(
    @Body() createVehicleDto: CreateVehicleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vehiclesService.create(createVehicleDto, user);
  }

  @Get()
  @Permissions(PERMISSIONS.VEHICLES.VIEW)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.vehiclesService.findAll(user);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.VEHICLES.VIEW)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vehiclesService.findOne(id, user);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.VEHICLES.UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vehiclesService.update(id, updateVehicleDto, user);
  }

  @Patch(':id/status')
  @Permissions(PERMISSIONS.VEHICLES.UPDATE)
  updateStatus(
    @Param('id') id: string,
    @Body() updateVehicleStatusDto: UpdateVehicleStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vehiclesService.updateStatus(id, updateVehicleStatusDto, user);
  }
}
