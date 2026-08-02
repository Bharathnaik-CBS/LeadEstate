import { BadRequestException, ConflictException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import type { PasswordResetOtpService } from '../auth/password-reset-otp.service';
import { Gender, OnboardingStatus, UserRole } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let passwordResetOtpService: {
    generateForUser: jest.Mock;
    assertValidOtp: jest.Mock;
    getClearData: jest.Mock;
  };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    passwordResetOtpService = {
      generateForUser: jest.fn().mockResolvedValue({
        expiresAt: new Date('2026-01-01T00:10:00.000Z'),
      }),
      assertValidOtp: jest.fn(),
      getClearData: jest.fn().mockReturnValue({
        passwordResetOtp: null,
        passwordResetOtpExp: null,
      }),
    };
    service = new UsersService(
      prisma as unknown as PrismaService,
      passwordResetOtpService as unknown as PasswordResetOtpService,
    );
  });

  it('creates a sales executive with the provided temporary password only', async () => {
    const safeUser = createSafeUser();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(safeUser);

    const result = await service.createSalesExecutive({
      seId: ' SE-001 ',
      email: 'Sales@Example.COM',
      password: 'StrongPass123!',
    });
    const createInput = prisma.user.create.mock.calls[0][0];

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            email: 'sales@example.com',
          },
          {
            seId: 'SE-001',
          },
        ],
      },
    });
    expect(createInput.data).toMatchObject({
      name: 'SE-001',
      email: 'sales@example.com',
      seId: 'SE-001',
      role: UserRole.SALES_EXECUTIVE,
      onboardingStatus: OnboardingStatus.CREATED,
    });
    expect(createInput.data.password).not.toBe('StrongPass123!');
    await expect(compare('StrongPass123!', createInput.data.password)).resolves.toBe(
      true,
    );
    await expect(compare('password123', createInput.data.password)).resolves.toBe(
      false,
    );
    expect(createInput.select.password).toBeUndefined();
    expect(result).toEqual(safeUser);
  });

  it('keeps duplicate email and SE ID checks', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      email: 'sales@example.com',
      seId: 'SE-001',
    });

    await expect(
      service.createSalesExecutive({
        seId: 'SE-001',
        email: 'sales@example.com',
        password: 'StrongPass123!',
      }),
    ).rejects.toThrow(ConflictException);

    prisma.user.findFirst.mockResolvedValueOnce({
      email: 'other@example.com',
      seId: 'SE-001',
    });

    await expect(
      service.createSalesExecutive({
        seId: 'SE-001',
        email: 'sales@example.com',
        password: 'StrongPass123!',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates managed PIM users without returning password data', async () => {
    const safeUser = createSafeUser({
      name: 'Inventory Manager',
      email: 'pim@example.com',
      role: UserRole.PROJECT_INVENTORY_MANAGER,
      seId: null,
      onboardingStatus: OnboardingStatus.ACTIVE,
    });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce(safeUser);

    const result = await service.createUser({
      name: ' Inventory Manager ',
      email: 'PIM@Example.COM',
      password: 'StrongPass123!',
      role: UserRole.PROJECT_INVENTORY_MANAGER,
      onboardingStatus: OnboardingStatus.ACTIVE,
    });
    const createInput = prisma.user.create.mock.calls[0][0];

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        email: 'pim@example.com',
      },
    });
    expect(createInput.data).toMatchObject({
      name: 'Inventory Manager',
      email: 'pim@example.com',
      role: UserRole.PROJECT_INVENTORY_MANAGER,
      onboardingStatus: OnboardingStatus.ACTIVE,
    });
    await expect(compare('StrongPass123!', createInput.data.password)).resolves.toBe(
      true,
    );
    expect(createInput.select.password).toBeUndefined();
    expect(result).toEqual(safeUser);
  });

  it('creates managed SVC users without returning password data', async () => {
    const safeUser = createSafeUser({
      name: 'Visit Coordinator',
      email: 'svc@example.com',
      role: UserRole.SITE_VISIT_COORDINATOR,
      seId: null,
      onboardingStatus: OnboardingStatus.ACTIVE,
    });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce(safeUser);

    const result = await service.createUser({
      name: ' Visit Coordinator ',
      email: 'SVC@Example.COM',
      password: 'StrongPass123!',
      role: UserRole.SITE_VISIT_COORDINATOR,
      onboardingStatus: OnboardingStatus.ACTIVE,
    });
    const createInput = prisma.user.create.mock.calls[0][0];

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        email: 'svc@example.com',
      },
    });
    expect(createInput.data).toMatchObject({
      name: 'Visit Coordinator',
      email: 'svc@example.com',
      role: UserRole.SITE_VISIT_COORDINATOR,
      onboardingStatus: OnboardingStatus.ACTIVE,
    });
    await expect(compare('StrongPass123!', createInput.data.password)).resolves.toBe(
      true,
    );
    expect(createInput.select.password).toBeUndefined();
    expect(result).toEqual(safeUser);
  });

  it('keeps the sales executive list active-only', async () => {
    const activeUser = createSafeUser({
      onboardingStatus: OnboardingStatus.ACTIVE,
    });
    prisma.user.findMany.mockResolvedValueOnce([activeUser]);

    await expect(service.findSalesExecutives()).resolves.toEqual([activeUser]);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        role: UserRole.SALES_EXECUTIVE,
        onboardingStatus: OnboardingStatus.ACTIVE,
      },
      orderBy: {
        name: 'asc',
      },
      select: expect.any(Object),
    });
  });

  it('lists all managed sales executives or filters by onboarding status', async () => {
    const rejectedUser = createSafeUser({
      onboardingStatus: OnboardingStatus.REJECTED,
    });
    prisma.user.findMany.mockResolvedValueOnce([rejectedUser]);

    await expect(service.findSalesExecutivesForManagement()).resolves.toEqual([
      rejectedUser,
    ]);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        role: UserRole.SALES_EXECUTIVE,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: expect.any(Object),
    });

    prisma.user.findMany.mockResolvedValueOnce([rejectedUser]);

    await expect(
      service.findSalesExecutivesForManagement(OnboardingStatus.REJECTED),
    ).resolves.toEqual([rejectedUser]);

    expect(prisma.user.findMany).toHaveBeenLastCalledWith({
      where: {
        role: UserRole.SALES_EXECUTIVE,
        onboardingStatus: OnboardingStatus.REJECTED,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: expect.any(Object),
    });
  });

  it('approves pending or rejected sales executives into profile completion', async () => {
    const pendingUser = createDbUser({
      onboardingStatus: OnboardingStatus.REJECTED,
    });
    const approvedUser = createSafeUser({
      onboardingStatus: OnboardingStatus.PROFILE_INCOMPLETE,
    });
    prisma.user.findUnique.mockResolvedValue(pendingUser);
    prisma.user.update.mockResolvedValue(approvedUser);

    await expect(service.approveSalesExecutive(pendingUser.id)).resolves.toEqual(
      approvedUser,
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: pendingUser.id,
      },
      data: {
        onboardingStatus: OnboardingStatus.PROFILE_INCOMPLETE,
      },
      select: expect.any(Object),
    });
  });

  it('rejects only pending approval sales executives', async () => {
    const pendingUser = createDbUser({
      onboardingStatus: OnboardingStatus.PENDING_ADMIN_APPROVAL,
    });
    const rejectedUser = createSafeUser({
      onboardingStatus: OnboardingStatus.REJECTED,
    });
    prisma.user.findUnique.mockResolvedValueOnce(pendingUser);
    prisma.user.update.mockResolvedValueOnce(rejectedUser);

    await expect(service.rejectSalesExecutive(pendingUser.id)).resolves.toEqual(
      rejectedUser,
    );

    prisma.user.findUnique.mockResolvedValueOnce(
      createDbUser({
        onboardingStatus: OnboardingStatus.ACTIVE,
      }),
    );

    await expect(service.rejectSalesExecutive('active-user')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('allows profile completion only from PROFILE_INCOMPLETE', async () => {
    const profileUser = createDbUser({
      onboardingStatus: OnboardingStatus.PROFILE_INCOMPLETE,
    });
    const completedUser = createSafeUser({
      firstName: 'Sales',
      lastName: 'User',
      username: 'sales.user',
      phoneNumber: '9876543210',
      dob: new Date('1995-01-01T00:00:00.000Z'),
      onboardingStatus: OnboardingStatus.PASSWORD_CHANGE_REQUIRED,
    });
    prisma.user.findUnique
      .mockResolvedValueOnce(profileUser)
      .mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValueOnce(completedUser);

    await expect(
      service.completeSalesProfile(profileUser.id, {
        firstName: 'Sales',
        lastName: 'User',
        username: 'Sales.User',
        phoneNumber: '9876543210',
        dob: '1995-01-01',
        gender: Gender.PREFER_NOT_TO_SAY,
      }),
    ).resolves.toEqual(completedUser);

    prisma.user.findUnique.mockResolvedValueOnce(
      createDbUser({
        onboardingStatus: OnboardingStatus.PENDING_ADMIN_APPROVAL,
      }),
    );

    await expect(
      service.completeSalesProfile('pending-user', {
        firstName: 'Sales',
        lastName: 'User',
        username: 'sales.user',
        phoneNumber: '9876543210',
        dob: '1995-01-01',
        gender: Gender.PREFER_NOT_TO_SAY,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('generates a password OTP without returning the OTP', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(
      createDbUser({
        onboardingStatus: OnboardingStatus.PASSWORD_CHANGE_REQUIRED,
      }),
    );

    const result = await service.generatePasswordOtp('password-user');

    expect(result).toEqual({
      expiresAt: new Date('2026-01-01T00:10:00.000Z'),
      message: 'OTP generated. Enter the OTP you received to change password.',
    });
    expect(result).not.toHaveProperty('otp');
    expect(passwordResetOtpService.generateForUser).toHaveBeenCalledWith(
      'user-1',
    );

    prisma.user.findUnique.mockResolvedValueOnce(
      createDbUser({
        onboardingStatus: OnboardingStatus.PROFILE_INCOMPLETE,
      }),
    );

    await expect(service.generatePasswordOtp('profile-user')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('changes password with a valid OTP, clears OTP fields, and activates the user', async () => {
    const otpHash = await hashForTest('123456');
    const passwordUser = createDbUser({
      onboardingStatus: OnboardingStatus.PASSWORD_CHANGE_REQUIRED,
      passwordResetOtp: otpHash,
      passwordResetOtpExp: new Date(Date.now() + 60_000),
    });
    const activeUser = createSafeUser({
      onboardingStatus: OnboardingStatus.ACTIVE,
    });
    prisma.user.findUnique.mockResolvedValueOnce(passwordUser);
    prisma.user.update.mockResolvedValueOnce(activeUser);

    await expect(
      service.changePasswordWithOtp(passwordUser.id, {
        otp: '123456',
        newPassword: 'NewStrong123!',
      }),
    ).resolves.toEqual(activeUser);

    const updateInput = prisma.user.update.mock.calls[0][0];

    expect(passwordResetOtpService.assertValidOtp).toHaveBeenCalledWith(
      passwordUser,
      '123456',
      'Invalid or expired OTP',
    );
    expect(updateInput.data).toMatchObject({
      passwordResetOtp: null,
      passwordResetOtpExp: null,
      onboardingStatus: OnboardingStatus.ACTIVE,
    });
    await expect(compare('NewStrong123!', updateInput.data.password)).resolves.toBe(
      true,
    );
  });

  it('does not update the password when OTP validation fails', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(
      createDbUser({
        onboardingStatus: OnboardingStatus.PASSWORD_CHANGE_REQUIRED,
        passwordResetOtp: await hashForTest('123456'),
        passwordResetOtpExp: new Date(Date.now() + 60_000),
      }),
    );
    passwordResetOtpService.assertValidOtp.mockRejectedValueOnce(
      new BadRequestException('Invalid or expired OTP'),
    );

    await expect(
      service.changePasswordWithOtp('password-user', {
        otp: '654321',
        newPassword: 'NewStrong123!',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  function createDbUser(overrides = {}) {
    return {
      password: 'hashed-password',
      passwordResetOtp: null,
      passwordResetOtpExp: null,
      ...createSafeUser(),
      ...overrides,
    };
  }

  function createSafeUser(overrides = {}) {
    return {
      id: 'user-1',
      name: 'SE-001',
      email: 'sales@example.com',
      role: UserRole.SALES_EXECUTIVE,
      seId: 'SE-001',
      username: null,
      firstName: null,
      lastName: null,
      phoneNumber: null,
      dob: null,
      gender: null,
      onboardingStatus: OnboardingStatus.CREATED,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  async function hashForTest(value: string) {
    return hash(value, 4);
  }
});
