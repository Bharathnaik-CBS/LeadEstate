import { BadRequestException, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

type UserWithPasswordResetOtp = {
  id: string;
  passwordResetOtp: string | null;
  passwordResetOtpExp: Date | null;
};

const OTP_EXPIRY_MS = 10 * 60 * 1000;

@Injectable()
export class PasswordResetOtpService {
  constructor(private readonly prisma: PrismaService) {}

  async generateForUser(userId: string) {
    const otp = this.generateOtp();
    const otpHash = await hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetOtp: otpHash,
        passwordResetOtpExp: expiresAt,
      },
    });

    return { expiresAt };
  }

  async assertValidOtp(
    user: UserWithPasswordResetOtp,
    otp: string,
    invalidMessage: string,
  ) {
    if (!user.passwordResetOtp || !user.passwordResetOtpExp) {
      throw new BadRequestException(invalidMessage);
    }

    if (user.passwordResetOtpExp < new Date()) {
      await this.clearForUser(user.id);
      throw new BadRequestException(invalidMessage);
    }

    const isOtpValid = await compare(otp, user.passwordResetOtp);

    if (!isOtpValid) {
      await this.clearForUser(user.id);
      throw new BadRequestException(invalidMessage);
    }
  }

  clearForUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: this.getClearData(),
    });
  }

  getClearData() {
    return {
      passwordResetOtp: null,
      passwordResetOtpExp: null,
    };
  }

  private generateOtp() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }
}
