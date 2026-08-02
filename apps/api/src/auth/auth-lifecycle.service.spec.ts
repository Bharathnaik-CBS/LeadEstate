import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OnboardingStatus, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthLifecycleService } from './auth-lifecycle.service';

describe('AuthLifecycleService', () => {
  const handler = jest.fn();
  const controller = class TestController {};
  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
  };
  let reflector: {
    getAllAndOverride: jest.Mock;
  };
  let request: {
    user?: {
      userId?: string;
      email?: string;
      role?: UserRole;
    };
  };
  let service: AuthLifecycleService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    request = {
      user: {
        userId: 'user-1',
        email: 'token@example.com',
        role: UserRole.SALES_EXECUTIVE,
      },
    };
    service = new AuthLifecycleService(
      prisma as unknown as PrismaService,
      reflector as unknown as Reflector,
    );
  });

  it('allows active users by default and refreshes request user from the database', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'fresh@example.com',
      role: UserRole.SALES_EXECUTIVE,
      onboardingStatus: OnboardingStatus.ACTIVE,
    });

    await service.enforce(createContext());

    expect(request.user).toEqual({
      userId: 'user-1',
      email: 'fresh@example.com',
      role: UserRole.SALES_EXECUTIVE,
      onboardingStatus: OnboardingStatus.ACTIVE,
    });
  });

  it('blocks non-active users on routes without lifecycle metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'pending@example.com',
      role: UserRole.SALES_EXECUTIVE,
      onboardingStatus: OnboardingStatus.PENDING_ADMIN_APPROVAL,
    });

    await expect(service.enforce(createContext())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows a route-declared onboarding status', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      OnboardingStatus.PROFILE_INCOMPLETE,
    ]);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'profile@example.com',
      role: UserRole.SALES_EXECUTIVE,
      onboardingStatus: OnboardingStatus.PROFILE_INCOMPLETE,
    });

    await expect(service.enforce(createContext())).resolves.toBeUndefined();
  });

  it('allows rejected users when the route explicitly permits that status', async () => {
    reflector.getAllAndOverride.mockReturnValue([OnboardingStatus.REJECTED]);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'rejected@example.com',
      role: UserRole.SALES_EXECUTIVE,
      onboardingStatus: OnboardingStatus.REJECTED,
    });

    await expect(service.enforce(createContext())).resolves.toBeUndefined();
  });

  it('rejects missing token users or deleted users', async () => {
    request.user = undefined;

    await expect(service.enforce(createContext())).rejects.toThrow(
      UnauthorizedException,
    );

    request.user = {
      userId: 'missing-user',
    };
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.enforce(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  function createContext(): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => handler,
      getClass: () => controller,
    } as unknown as ExecutionContext;
  }
});
