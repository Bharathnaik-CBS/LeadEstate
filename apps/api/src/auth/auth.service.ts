import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingStatus, Prisma, type User } from '../generated/prisma/client';
import { getPostLoginOnboardingStatus } from '../users/onboarding-lifecycle';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetOtpService } from './password-reset-otp.service';

const INVALID_LOGIN_MESSAGE = 'Invalid credentials';
const FORGOT_PASSWORD_RESPONSE_MESSAGE =
  'If the account exists, a reset code has been sent.';
const INVALID_OR_EXPIRED_RESET_CODE_MESSAGE = 'Invalid or expired reset code';
const PASSWORD_RESET_SUCCESS_MESSAGE =
  'Password reset successful. Sign in with your new password.';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly passwordResetOtpService: PasswordResetOtpService,
  ) {}

  async login(loginDto: LoginDto) {
    const identifier = this.normalizeLoginIdentifier(
      loginDto.identifier ?? loginDto.email,
    );

    if (!identifier) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    const user = await this.prisma.user.findFirst({
      where: this.getLoginWhere(identifier),
    });

    if (!user) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    const isPasswordValid = await compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException(INVALID_LOGIN_MESSAGE);
    }

    const nextOnboardingStatus = getPostLoginOnboardingStatus(
      user.onboardingStatus,
    );
    const loginUser =
      nextOnboardingStatus !== user.onboardingStatus
        ? await this.prisma.user.update({
            where: { id: user.id },
            data: {
              onboardingStatus: nextOnboardingStatus,
            },
          })
        : user;

    const accessToken = await this.signAccessToken(loginUser);

    return {
      user: this.toSafeUser(loginUser),
      accessToken,
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const identifier = this.normalizeLoginIdentifier(
      forgotPasswordDto.identifier,
    );

    if (identifier) {
      const user = await this.prisma.user.findFirst({
        where: {
          AND: [
            this.getLoginWhere(identifier),
            {
              onboardingStatus: OnboardingStatus.ACTIVE,
            },
          ],
        },
      });

      if (user) {
        await this.passwordResetOtpService.generateForUser(user.id);
      }
    }

    return {
      message: FORGOT_PASSWORD_RESPONSE_MESSAGE,
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const identifier = this.normalizeLoginIdentifier(
      resetPasswordDto.identifier,
    );

    if (!identifier) {
      throw new BadRequestException(INVALID_OR_EXPIRED_RESET_CODE_MESSAGE);
    }

    const user = await this.prisma.user.findFirst({
      where: {
        AND: [
          this.getLoginWhere(identifier),
          {
            onboardingStatus: OnboardingStatus.ACTIVE,
          },
        ],
      },
    });

    if (!user) {
      throw new BadRequestException(INVALID_OR_EXPIRED_RESET_CODE_MESSAGE);
    }

    await this.passwordResetOtpService.assertValidOtp(
      user,
      resetPasswordDto.otp,
      INVALID_OR_EXPIRED_RESET_CODE_MESSAGE,
    );

    const passwordHash = await hash(resetPasswordDto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        ...this.passwordResetOtpService.getClearData(),
      },
    });

    return {
      message: PASSWORD_RESET_SUCCESS_MESSAGE,
    };
  }

  private getLoginWhere(identifier: string): Prisma.UserWhereInput {
    return {
      OR: [
        {
          email: identifier,
        },
        {
          username: identifier,
        },
      ],
    };
  }

  private normalizeLoginIdentifier(identifier?: string) {
    return identifier?.trim().toLowerCase() ?? '';
  }

  private async signAccessToken(user: User) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private toSafeUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      seId: user.seId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      dob: user.dob,
      gender: user.gender,
      onboardingStatus: user.onboardingStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
