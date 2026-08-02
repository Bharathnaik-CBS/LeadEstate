import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OnboardingStatus, UserRole } from '../../generated/prisma/client';
import { PERMISSIONS } from '../permissions';
import type { AuthenticatedUser } from '../types/authenticated-user';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const handler = jest.fn();
  const controller = class TestController {};
  let reflector: {
    getAllAndOverride: jest.Mock;
  };
  let request: {
    user?: AuthenticatedUser;
  };
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    request = {};
    guard = new PermissionsGuard(reflector as unknown as Reflector);
  });

  it('allows routes with no permission metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('denies unauthenticated requests when permissions are required', () => {
    reflector.getAllAndOverride.mockReturnValue([PERMISSIONS.LEADS.CREATE]);

    expect(() => guard.canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('allows ADMIN for any required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([PERMISSIONS.LEADS.DELETE]);
    request.user = createUser(UserRole.ADMIN);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows a user with the required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([PERMISSIONS.LEADS.CREATE]);
    request.user = createUser(UserRole.SALES_EXECUTIVE);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('denies a user without the required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([
      PERMISSIONS.SALES_EXECUTIVES.MANAGE,
    ]);
    request.user = createUser(UserRole.SALES_EXECUTIVE);

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });

  function createUser(role: UserRole): AuthenticatedUser {
    return {
      userId: 'user-1',
      email: 'user@example.com',
      role,
      onboardingStatus: OnboardingStatus.ACTIVE,
    };
  }

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
