import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';
import { ActivityEventsService } from './activity-events.service';
import { ListActivityEventsDto } from './dto/list-activity-events.dto';

@Controller('activity-events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ActivityEventsController {
  constructor(private readonly activityEventsService: ActivityEventsService) {}

  @Get()
  @Permissions(PERMISSIONS.ACTIVITY_EVENTS.VIEW_ALL)
  findAll(@Query() query: ListActivityEventsDto) {
    return this.activityEventsService.findAll(query);
  }
}
