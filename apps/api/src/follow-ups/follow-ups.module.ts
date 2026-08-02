import { Module } from '@nestjs/common';
import { ActivityEventsModule } from '../activity-events/activity-events.module';
import { AuthModule } from '../auth/auth.module';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpsService } from './follow-ups.service';

@Module({
  imports: [AuthModule, ActivityEventsModule],
  controllers: [FollowUpsController],
  providers: [FollowUpsService],
})
export class FollowUpsModule {}
