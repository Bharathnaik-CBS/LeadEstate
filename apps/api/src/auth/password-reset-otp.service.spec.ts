import { BadRequestException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import type { PrismaService } from '../prisma/prisma.service';
import { PasswordResetOtpService } from './password-reset-otp.service';

describe('PasswordResetOtpService', () => {
  let prisma: {
    user: {
      update: jest.Mock;
    };
  };
  let service: PasswordResetOtpService;

  beforeEach(() => {
    prisma = {
      user: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new PasswordResetOtpService(prisma as unknown as PrismaService);
  });

  it('generates and stores a hashed OTP without returning the OTP', async () => {
    const result = await service.generateForUser('user-1');
    const updateInput = prisma.user.update.mock.calls[0][0];

    expect(result).toEqual({
      expiresAt: expect.any(Date),
    });
    expect(result).not.toHaveProperty('otp');
    expect(updateInput).toEqual({
      where: {
        id: 'user-1',
      },
      data: {
        passwordResetOtp: expect.any(String),
        passwordResetOtpExp: expect.any(Date),
      },
    });
    expect(updateInput.data.passwordResetOtp).not.toMatch(/^\d{6}$/);
  });

  it('accepts a valid unexpired OTP without clearing it first', async () => {
    await expect(
      service.assertValidOtp(
        {
          id: 'user-1',
          passwordResetOtp: await hash('123456', 4),
          passwordResetOtpExp: new Date(Date.now() + 60_000),
        },
        '123456',
        'Invalid or expired reset code',
      ),
    ).resolves.toBeUndefined();

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('clears OTP fields on invalid OTP attempts', async () => {
    await expect(
      service.assertValidOtp(
        {
          id: 'user-1',
          passwordResetOtp: await hash('123456', 4),
          passwordResetOtpExp: new Date(Date.now() + 60_000),
        },
        '654321',
        'Invalid or expired reset code',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        passwordResetOtp: null,
        passwordResetOtpExp: null,
      },
    });
  });

  it('clears OTP fields on expired OTP attempts', async () => {
    await expect(
      service.assertValidOtp(
        {
          id: 'user-1',
          passwordResetOtp: await hash('123456', 4),
          passwordResetOtpExp: new Date(Date.now() - 60_000),
        },
        '123456',
        'Invalid or expired reset code',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        passwordResetOtp: null,
        passwordResetOtpExp: null,
      },
    });
  });
});
