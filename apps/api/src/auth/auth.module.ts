import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthLifecycleService } from './auth-lifecycle.service';
import { getJwtExpiresIn, getJwtSecret } from './auth-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './jwt.strategy';
import { PasswordResetOtpService } from './password-reset-otp.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret: getJwtSecret(configService),
          signOptions: {
            expiresIn: getJwtExpiresIn(configService),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthLifecycleService,
    PasswordResetOtpService,
    JwtStrategy,
    JwtAuthGuard,
    PermissionsGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    AuthLifecycleService,
    JwtAuthGuard,
    PermissionsGuard,
    RolesGuard,
    PasswordResetOtpService,
  ],
})
export class AuthModule {}
