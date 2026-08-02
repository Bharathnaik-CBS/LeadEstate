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
import { CancelSiteVisitDto } from './dto/cancel-site-visit.dto';
import { CompleteSiteVisitDto } from './dto/complete-site-visit.dto';
import { CreateSiteVisitDto } from './dto/create-site-visit.dto';
import { UpdateSiteVisitDto } from './dto/update-site-visit.dto';
import { SiteVisitsService } from './site-visits.service';

@Controller('site-visits')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SiteVisitsController {
  constructor(private readonly siteVisitsService: SiteVisitsService) {}

  @Post()
  @Permissions(PERMISSIONS.SITE_VISITS.CREATE)
  create(
    @Body() createSiteVisitDto: CreateSiteVisitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.siteVisitsService.create(createSiteVisitDto, user);
  }

  @Get()
  @Permissions(PERMISSIONS.SITE_VISITS.VIEW_ASSIGNED)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.siteVisitsService.findAll(user);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.SITE_VISITS.VIEW_ASSIGNED)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.siteVisitsService.findOne(id, user);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.SITE_VISITS.UPDATE_ASSIGNED)
  update(
    @Param('id') id: string,
    @Body() updateSiteVisitDto: UpdateSiteVisitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.siteVisitsService.update(id, updateSiteVisitDto, user);
  }

  @Patch(':id/start')
  @Permissions(PERMISSIONS.SITE_VISITS.UPDATE_ASSIGNED)
  start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.siteVisitsService.start(id, user);
  }

  @Patch(':id/complete')
  @Permissions(PERMISSIONS.SITE_VISITS.UPDATE_ASSIGNED)
  complete(
    @Param('id') id: string,
    @Body() completeSiteVisitDto: CompleteSiteVisitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.siteVisitsService.complete(id, completeSiteVisitDto, user);
  }

  @Patch(':id/cancel')
  @Permissions(PERMISSIONS.SITE_VISITS.CANCEL)
  cancel(
    @Param('id') id: string,
    @Body() cancelSiteVisitDto: CancelSiteVisitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.siteVisitsService.cancel(id, cancelSiteVisitDto, user);
  }
}
