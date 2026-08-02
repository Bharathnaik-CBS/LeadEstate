import {
  Body,
  Controller,
  Delete,
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
import { AssignLeadDto } from './dto/assign-lead.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get('dashboard/summary')
  @Permissions(PERMISSIONS.DASHBOARD.VIEW_SUMMARY)
  getDashboardSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.getDashboardSummary(user);
  }

  @Get('my')
  @Permissions(PERMISSIONS.LEADS.VIEW_ASSIGNED)
  getMyLeads(@CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.findAssignedToUser(user);
  }

  @Post()
  @Permissions(PERMISSIONS.LEADS.CREATE)
  create(
    @Body() createLeadDto: CreateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.create(createLeadDto, user);
  }

  @Get()
  @Permissions(PERMISSIONS.LEADS.VIEW_ALL)
  findAll() {
    return this.leadsService.findAll();
  }

  @Get(':id')
  @Permissions(PERMISSIONS.LEADS.VIEW_ALL)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.findOne(id, user);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.LEADS.UPDATE_ALL)
  update(
    @Param('id') id: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.update(id, updateLeadDto, user);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.LEADS.DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.remove(id, user);
  }

  @Patch(':id/assign')
  @Permissions(PERMISSIONS.LEADS.ASSIGN)
  assign(
    @Param('id') id: string,
    @Body() assignLeadDto: AssignLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.assign(id, assignLeadDto, user);
  }

  @Patch(':id/status')
  @Permissions(PERMISSIONS.LEADS.UPDATE_ASSIGNED)
  updateStatus(
    @Param('id') id: string,
    @Body() updateLeadStatusDto: UpdateLeadStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.updateAssignedLeadStatus(
      id,
      user,
      updateLeadStatusDto,
    );
  }
}
