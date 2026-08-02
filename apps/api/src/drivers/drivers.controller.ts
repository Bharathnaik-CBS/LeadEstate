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
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriversService } from './drivers.service';

@Controller('drivers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @Permissions(PERMISSIONS.DRIVERS.CREATE)
  create(
    @Body() createDriverDto: CreateDriverDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.driversService.create(createDriverDto, user);
  }

  @Get()
  @Permissions(PERMISSIONS.DRIVERS.VIEW)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.driversService.findAll(user);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.DRIVERS.VIEW)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.driversService.findOne(id, user);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.DRIVERS.UPDATE)
  update(
    @Param('id') id: string,
    @Body() updateDriverDto: UpdateDriverDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.driversService.update(id, updateDriverDto, user);
  }

  @Patch(':id/status')
  @Permissions(PERMISSIONS.DRIVERS.UPDATE)
  updateStatus(
    @Param('id') id: string,
    @Body() updateDriverStatusDto: UpdateDriverStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.driversService.updateStatus(id, updateDriverStatusDto, user);
  }
}
