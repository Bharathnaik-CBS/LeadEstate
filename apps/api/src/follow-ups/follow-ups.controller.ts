import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { UpdateFollowUpDto } from './dto/update-follow-up.dto';
import { FollowUpsService } from './follow-ups.service';

@Controller('follow-ups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Post()
  @Permissions(PERMISSIONS.FOLLOW_UPS.CREATE)
  create(
    @Body() createFollowUpDto: CreateFollowUpDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.followUpsService.create(createFollowUpDto, user);
  }

  @Get()
  @Permissions(PERMISSIONS.FOLLOW_UPS.VIEW_ASSIGNED)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.followUpsService.findAll(user);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.FOLLOW_UPS.VIEW_ASSIGNED)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.followUpsService.findOne(id, user);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.FOLLOW_UPS.UPDATE_ASSIGNED)
  update(
    @Param('id') id: string,
    @Body() updateFollowUpDto: UpdateFollowUpDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.followUpsService.update(id, updateFollowUpDto, user);
  }
}
