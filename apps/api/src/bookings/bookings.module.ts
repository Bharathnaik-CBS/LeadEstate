import { Module } from '@nestjs/common';
import { ActivityEventsModule } from '../activity-events/activity-events.module';
import { AuthModule } from '../auth/auth.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthModule, ActivityEventsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
