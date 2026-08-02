import { Module } from '@nestjs/common';
import { ActivityEventsModule } from '../activity-events/activity-events.module';
import { AuthModule } from '../auth/auth.module';
import { SiteVisitsController } from './site-visits.controller';
import { SiteVisitsService } from './site-visits.service';

@Module({
  imports: [AuthModule, ActivityEventsModule],
  controllers: [SiteVisitsController],
  providers: [SiteVisitsService],
})
export class SiteVisitsModule {}
