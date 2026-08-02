import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActivityEventsModule } from './activity-events/activity-events.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DriversModule } from './drivers/drivers.module';
import { FollowUpsModule } from './follow-ups/follow-ups.module';
import { LeadsModule } from './leads/leads.module';
import { PlatformsModule } from './platforms/platforms.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { ReportsModule } from './reports/reports.module';
import { SiteVisitsModule } from './site-visits/site-visits.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env'],
    }),
    ActivityEventsModule,
    AuthModule,
    BookingsModule,
    CustomersModule,
    DashboardModule,
    DriversModule,
    FollowUpsModule,
    LeadsModule,
    PlatformsModule,
    PrismaModule,
    ProjectsModule,
    ReportsModule,
    SiteVisitsModule,
    UsersModule,
    VehiclesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
