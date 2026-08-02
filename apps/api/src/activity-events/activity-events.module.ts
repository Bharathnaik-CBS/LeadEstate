import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityEventsController } from './activity-events.controller';
import { ActivityEventsService } from './activity-events.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ActivityEventsController],
  providers: [ActivityEventsService],
  exports: [ActivityEventsService],
})
export class ActivityEventsModule {}