import { Module } from '@nestjs/common';
import { ActivityEventsModule } from '../activity-events/activity-events.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [AuthModule, ActivityEventsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
