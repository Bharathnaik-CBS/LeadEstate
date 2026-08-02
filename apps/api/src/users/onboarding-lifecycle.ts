import { BadRequestException } from '@nestjs/common';
import { OnboardingStatus } from '../generated/prisma/client';

export const PENDING_APPROVAL_STATUSES: OnboardingStatus[] = [
  OnboardingStatus.CREATED,
  OnboardingStatus.PENDING_ADMIN_APPROVAL,
];

export const APPROVABLE_ONBOARDING_STATUSES: OnboardingStatus[] = [
  ...PENDING_APPROVAL_STATUSES,
  OnboardingStatus.REJECTED,
];

export const REJECTABLE_ONBOARDING_STATUSES: OnboardingStatus[] = [
  ...PENDING_APPROVAL_STATUSES,
];

export const PROFILE_COMPLETION_STATUSES: OnboardingStatus[] = [
  OnboardingStatus.PROFILE_INCOMPLETE,
];

export const PASSWORD_CHANGE_STATUSES: OnboardingStatus[] = [
  OnboardingStatus.PASSWORD_CHANGE_REQUIRED,
];

export function getPostLoginOnboardingStatus(status: OnboardingStatus) {
  return status === OnboardingStatus.CREATED
    ? OnboardingStatus.PENDING_ADMIN_APPROVAL
    : status;
}

export function assertOnboardingStatus(
  status: OnboardingStatus,
  allowedStatuses: readonly OnboardingStatus[],
  message: string,
) {
  if (!allowedStatuses.includes(status)) {
    throw new BadRequestException(message);
  }
}
