import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  OnboardingStatus,
  Prisma,
  UserRole,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALLOWED_ONBOARDING_STATUSES_KEY,
} from './decorators/onboarding-statuses.decorator';
import type { RequestWithPartialAuthenticatedUser } from './types/authenticated-user';

@Injectable()
export class AuthLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async enforce(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithPartialAuthenticatedUser>();
    const tokenUser = request.user;

    if (!tokenUser?.userId) {
      throw new UnauthorizedException('Invalid session');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: tokenUser.userId },
      select: this.currentUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    const allowedStatuses = this.getAllowedStatuses(context);

    if (!allowedStatuses.includes(user.onboardingStatus)) {
      throw new ForbiddenException(this.getStatusMessage(user));
    }

    request.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      onboardingStatus: user.onboardingStatus,
    };
  }

  private getAllowedStatuses(context: ExecutionContext) {
    return (
      this.reflector.getAllAndOverride<OnboardingStatus[]>(
        ALLOWED_ONBOARDING_STATUSES_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [OnboardingStatus.ACTIVE]
    );
  }

  private getStatusMessage(user: {
    role: UserRole;
    onboardingStatus: OnboardingStatus;
  }) {
    if (user.onboardingStatus === OnboardingStatus.ACTIVE) {
      return 'This resource is not available for the current account status';
    }

    if (user.role === UserRole.ADMIN) {
      return 'Admin account is not active';
    }

    switch (user.onboardingStatus) {
      case OnboardingStatus.CREATED:
      case OnboardingStatus.PENDING_ADMIN_APPROVAL:
        return 'Sales executive account is pending admin approval';
      case OnboardingStatus.PROFILE_INCOMPLETE:
        return 'Complete your profile before accessing this resource';
      case OnboardingStatus.PASSWORD_CHANGE_REQUIRED:
        return 'Change your password before accessing this resource';
      case OnboardingStatus.REJECTED:
        return 'Sales executive account was rejected';
      default:
        return 'Account is not active';
    }
  }

  private readonly currentUserSelect = {
    id: true,
    email: true,
    role: true,
    onboardingStatus: true,
  } satisfies Prisma.UserSelect;
}
