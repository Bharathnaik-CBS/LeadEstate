import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';
import { PlatformsService } from './platforms.service';

@Controller('platforms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlatformsController {
  constructor(private readonly platformsService: PlatformsService) {}

  @Post()
  @Permissions(PERMISSIONS.PLATFORMS.PLATFORM_CREATE)
  create(@Body() createPlatformDto: CreatePlatformDto) {
    return this.platformsService.create(createPlatformDto);
  }

  @Get()
  @Permissions(PERMISSIONS.PLATFORMS.PLATFORM_READ)
  findAll() {
    return this.platformsService.findAll();
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.PLATFORMS.PLATFORM_UPDATE)
  update(
    @Param('id') id: string,
    @Body() updatePlatformDto: UpdatePlatformDto,
  ) {
    return this.platformsService.update(id, updatePlatformDto);
  }
}
