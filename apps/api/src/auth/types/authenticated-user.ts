import type { OnboardingStatus, UserRole } from '../../generated/prisma/client';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  onboardingStatus: OnboardingStatus;
}

export type RequestWithAuthenticatedUser = {
  user?: AuthenticatedUser;
};

export type RequestWithPartialAuthenticatedUser = {
  user?: Partial<AuthenticatedUser> & {
    userId?: string;
  };
};
