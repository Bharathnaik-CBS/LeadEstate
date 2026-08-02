import { Module } from '@nestjs/common';
import { ActivityEventsModule } from '../activity-events/activity-events.module';
import { AuthModule } from '../auth/auth.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [AuthModule, ActivityEventsModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
