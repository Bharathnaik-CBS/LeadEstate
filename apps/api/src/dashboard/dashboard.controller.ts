import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';
import { AdminDashboardQueryDto } from './dto/admin-dashboard-query.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('health')
  health() {
    return this.dashboardService.health();
  }

  @Get('admin/summary')
  @Permissions(PERMISSIONS.DASHBOARD.VIEW_ADMIN_SUMMARY)
  getAdminSummary(@Query() query: AdminDashboardQueryDto) {
    return this.dashboardService.getAdminSummary(query);
  }

  @Get('sales/summary')
  @Permissions(PERMISSIONS.DASHBOARD.VIEW_OWN_SUMMARY)
  getSalesSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getSalesSummary(user);
  }

  @Get('pending-actions')
  @Permissions(PERMISSIONS.DASHBOARD.VIEW_SUMMARY)
  getPendingActions(@Query('take') take?: string) {
    return this.dashboardService.getPendingActions(take);
  }

  @Get('recent-activity')
  @Permissions(PERMISSIONS.DASHBOARD.VIEW_SUMMARY)
  getRecentActivity(
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.dashboardService.getRecentActivity(take, cursor);
  }
}
