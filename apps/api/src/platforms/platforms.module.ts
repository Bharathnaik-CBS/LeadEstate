import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformsController } from './platforms.controller';
import { PlatformsService } from './platforms.service';

@Module({
  imports: [AuthModule],
  controllers: [PlatformsController],
  providers: [PlatformsService],
})
export class PlatformsModule {}
