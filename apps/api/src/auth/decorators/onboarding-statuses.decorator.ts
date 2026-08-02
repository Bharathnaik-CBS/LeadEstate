import { SetMetadata } from '@nestjs/common';
import { OnboardingStatus } from '../../generated/prisma/client';

export const ALLOWED_ONBOARDING_STATUSES_KEY = 'allowedOnboardingStatuses';

export const ALL_ONBOARDING_STATUSES: OnboardingStatus[] = [
  OnboardingStatus.CREATED,
  OnboardingStatus.PENDING_ADMIN_APPROVAL,
  OnboardingStatus.PROFILE_INCOMPLETE,
  OnboardingStatus.PASSWORD_CHANGE_REQUIRED,
  OnboardingStatus.ACTIVE,
  OnboardingStatus.REJECTED,
];

export const AllowOnboardingStatuses = (...statuses: OnboardingStatus[]) =>
  SetMetadata(ALLOWED_ONBOARDING_STATUSES_KEY, statuses);

export const AllowAnyOnboardingStatus = () =>
  AllowOnboardingStatuses(...ALL_ONBOARDING_STATUSES);
