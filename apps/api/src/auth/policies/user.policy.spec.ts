import { OnboardingStatus, UserRole } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user';
import { canUseSalesSelfService } from './user.policy';

describe('user policy', () => {
  it('allows SALES_EXECUTIVE self-service flows', () => {
    expect(
      canUseSalesSelfService(createUser('sales-1', UserRole.SALES_EXECUTIVE)),
    ).toBe(true);
  });

  it('does not treat ADMIN as eligible for SE self-service flows', () => {
    expect(canUseSalesSelfService(createUser('admin-1', UserRole.ADMIN))).toBe(
      false,
    );
  });

  function createUser(userId: string, role: UserRole): AuthenticatedUser {
    return {
      userId,
      email: `${userId}@example.com`,
      role,
      onboardingStatus: OnboardingStatus.ACTIVE,
    };
  }
});
