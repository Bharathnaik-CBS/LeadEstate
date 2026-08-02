import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { OnboardingStatus, UserRole } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { PasswordResetOtpService } from './password-reset-otp.service';

describe('AuthService', () => {
  let jwtService: {
    signAsync: jest.Mock;
  };
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let passwordResetOtpService: {
    generateForUser: jest.Mock;
    assertValidOtp: jest.Mock;
    getClearData: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    };
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    passwordResetOtpService = {
      generateForUser: jest.fn(),
      assertValidOtp: jest.fn(),
      getClearData: jest.fn().mockReturnValue({
        passwordResetOtp: null,
        passwordResetOtpExp: null,
      }),
    };
    service = new AuthService(
      jwtService as unknown as JwtService,
      prisma as unknown as PrismaService,
      passwordResetOtpService as unknown as PasswordResetOtpService,
    );
  });

  it('normalizes login identifiers before querying by email or username', async () => {
    const user = createUser({
      password: await hash('correct-password', 4),
    });
    prisma.user.findFirst.mockResolvedValue(user);

    await service.login({
      identifier: '  Admin@LeadEstate.COM  ',
      password: 'correct-password',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            email: 'admin@leadestate.com',
          },
          {
            username: 'admin@leadestate.com',
          },
        ],
      },
    });
  });

  it('moves CREATED sales executives to pending approval on login', async () => {
    const user = createUser({
      role: UserRole.SALES_EXECUTIVE,
      onboardingStatus: OnboardingStatus.CREATED,
      password: await hash('correct-password', 4),
    });
    const updatedUser = {
      ...user,
      onboardingStatus: OnboardingStatus.PENDING_ADMIN_APPROVAL,
    };
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(updatedUser);

    const session = await service.login({
      identifier: 'sales@example.com',
      password: 'correct-password',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: user.id,
      },
      data: {
        onboardingStatus: OnboardingStatus.PENDING_ADMIN_APPROVAL,
      },
    });
    expect(session.user.onboardingStatus).toBe(
      OnboardingStatus.PENDING_ADMIN_APPROVAL,
    );
  });

  it('returns the same safe login error for missing, unknown, and invalid credentials', async () => {
    await expectInvalidCredentials(
      service.login({
        identifier: '   ',
        password: 'anything-at-all',
      }),
    );

    prisma.user.findFirst.mockResolvedValueOnce(null);

    await expectInvalidCredentials(
      service.login({
        identifier: 'missing@example.com',
        password: 'anything-at-all',
      }),
    );

    prisma.user.findFirst.mockResolvedValueOnce(
      createUser({
        password: await hash('correct-password', 4),
      }),
    );

    await expectInvalidCredentials(
      service.login({
        identifier: 'admin@leadestate.com',
        password: 'wrong-password',
      }),
    );
  });

  it('returns a generic forgot password response and generates OTPs only for active users', async () => {
    const activeUser = createUser();
    prisma.user.findFirst.mockResolvedValueOnce(activeUser);
    passwordResetOtpService.generateForUser.mockResolvedValueOnce({
      expiresAt: new Date('2026-01-01T00:10:00.000Z'),
    });

    await expect(
      service.forgotPassword({
        identifier: '  Admin@LeadEstate.COM  ',
      }),
    ).resolves.toEqual({
      message: 'If the account exists, a reset code has been sent.',
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              {
                email: 'admin@leadestate.com',
              },
              {
                username: 'admin@leadestate.com',
              },
            ],
          },
          {
            onboardingStatus: OnboardingStatus.ACTIVE,
          },
        ],
      },
    });
    expect(passwordResetOtpService.generateForUser).toHaveBeenCalledWith(
      activeUser.id,
    );

    prisma.user.findFirst.mockResolvedValueOnce(null);
    passwordResetOtpService.generateForUser.mockClear();

    await expect(
      service.forgotPassword({
        identifier: 'missing@example.com',
      }),
    ).resolves.toEqual({
      message: 'If the account exists, a reset code has been sent.',
    });
    expect(passwordResetOtpService.generateForUser).not.toHaveBeenCalled();
  });

  it('resets an active user password with a valid OTP without issuing a JWT', async () => {
    const activeUser = createUser({
      passwordResetOtp: 'hashed-otp',
      passwordResetOtpExp: new Date(Date.now() + 60_000),
    });
    prisma.user.findFirst.mockResolvedValueOnce(activeUser);
    prisma.user.update.mockResolvedValueOnce({});

    const result = await service.resetPassword({
      identifier: 'ADMIN@LeadEstate.COM',
      otp: '123456',
      newPassword: 'NewStrong123!',
    });
    const updateInput = prisma.user.update.mock.calls[0][0];

    expect(passwordResetOtpService.assertValidOtp).toHaveBeenCalledWith(
      activeUser,
      '123456',
      'Invalid or expired reset code',
    );
    expect(updateInput).toMatchObject({
      where: {
        id: activeUser.id,
      },
      data: {
        passwordResetOtp: null,
        passwordResetOtpExp: null,
      },
    });
    expect(updateInput.data).not.toHaveProperty('onboardingStatus');
    await expect(compare('NewStrong123!', updateInput.data.password)).resolves.toBe(
      true,
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
    expect(result).toEqual({
      message: 'Password reset successful. Sign in with your new password.',
    });
  });

  it('uses the same reset failure for missing or non-active users', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.resetPassword({
        identifier: 'missing@example.com',
        otp: '123456',
        newPassword: 'NewStrong123!',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(passwordResetOtpService.assertValidOtp).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  async function expectInvalidCredentials(promise: Promise<unknown>) {
    await expect(promise).rejects.toThrow(UnauthorizedException);
    await expect(promise).rejects.toThrow('Invalid credentials');
  }

  function createUser(overrides = {}) {
    return {
      id: 'user-1',
      name: 'Admin User',
      email: 'admin@leadestate.com',
      password: 'hashed-password',
      role: UserRole.ADMIN,
      seId: null,
      username: null,
      firstName: null,
      lastName: null,
      phoneNumber: null,
      dob: null,
      gender: null,
      onboardingStatus: OnboardingStatus.ACTIVE,
      passwordResetOtp: null,
      passwordResetOtpExp: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }
});
