import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';
import { ReportDateRangeDto } from './dto/report-date-range.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('leads')
  @Permissions(PERMISSIONS.REPORTS.VIEW)
  getLeadsReport(@Query() query: ReportDateRangeDto) {
    return this.reportsService.getLeadsReport(query);
  }

  @Get('leads/export')
  @Permissions(PERMISSIONS.REPORTS.VIEW, PERMISSIONS.REPORTS.EXPORT)
  async exportLeadsReport(
    @Query() query: ReportDateRangeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.reportsService.exportLeadsReport(query);
    this.setCsvHeaders(response, file.filename);
    return file.content;
  }

  @Get('bookings')
  @Permissions(PERMISSIONS.REPORTS.VIEW)
  getBookingsReport(@Query() query: ReportDateRangeDto) {
    return this.reportsService.getBookingsReport(query);
  }

  @Get('bookings/export')
  @Permissions(PERMISSIONS.REPORTS.VIEW, PERMISSIONS.REPORTS.EXPORT)
  async exportBookingsReport(
    @Query() query: ReportDateRangeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.reportsService.exportBookingsReport(query);
    this.setCsvHeaders(response, file.filename);
    return file.content;
  }

  @Get('sales-performance')
  @Permissions(PERMISSIONS.REPORTS.VIEW)
  getSalesPerformanceReport(@Query() query: ReportDateRangeDto) {
    return this.reportsService.getSalesPerformanceReport(query);
  }

  @Get('sales-performance/export')
  @Permissions(PERMISSIONS.REPORTS.VIEW, PERMISSIONS.REPORTS.EXPORT)
  async exportSalesPerformanceReport(
    @Query() query: ReportDateRangeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.reportsService.exportSalesPerformanceReport(query);
    this.setCsvHeaders(response, file.filename);
    return file.content;
  }

  private setCsvHeaders(response: Response, filename: string) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
  }
}
