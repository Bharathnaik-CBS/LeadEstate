import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { PasswordResetOtpService } from '../auth/password-reset-otp.service';
import {
  canUseSalesSelfService,
  throwForbiddenUnless,
} from '../auth/policies';
import {
  OnboardingStatus,
  Prisma,
  UserRole,
  type User,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordWithOtpDto } from './dto/change-password-with-otp.dto';
import { CompleteSalesProfileDto } from './dto/complete-sales-profile.dto';
import { CreateSalesExecutiveDto } from './dto/create-sales-executive.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import {
  APPROVABLE_ONBOARDING_STATUSES,
  PASSWORD_CHANGE_STATUSES,
  PENDING_APPROVAL_STATUSES,
  PROFILE_COMPLETION_STATUSES,
  REJECTABLE_ONBOARDING_STATUSES,
  assertOnboardingStatus,
} from './onboarding-lifecycle';

const INVALID_OR_EXPIRED_OTP_MESSAGE = 'Invalid or expired OTP';
const ADMIN_MANAGED_ROLES: readonly UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.PROJECT_INVENTORY_MANAGER,
  UserRole.SITE_VISIT_COORDINATOR,
] as const;
const ADMIN_USER_STATUSES: readonly OnboardingStatus[] = [
  OnboardingStatus.ACTIVE,
  OnboardingStatus.REJECTED,
] as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordResetOtpService: PasswordResetOtpService,
  ) {}

  findSalesExecutives() {
    return this.prisma.user.findMany({
      where: {
        role: UserRole.SALES_EXECUTIVE,
        onboardingStatus: OnboardingStatus.ACTIVE,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        seId: true,
        username: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        dob: true,
        gender: true,
        onboardingStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  findSalesExecutivesForManagement(onboardingStatus?: OnboardingStatus) {
    return this.prisma.user.findMany({
      where: {
        role: UserRole.SALES_EXECUTIVE,
        ...(onboardingStatus ? { onboardingStatus } : {}),
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: this.safeUserSelect,
    });
  }

  findManagedUsers(query: ListUsersDto = {}) {
    return this.prisma.user.findMany({
      where: {
        role: query.role
          ? query.role
          : {
              in: [...ADMIN_MANAGED_ROLES],
            },
        ...(query.onboardingStatus
          ? { onboardingStatus: query.onboardingStatus }
          : {}),
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: this.safeUserSelect,
    });
  }

  async createUser(createDto: CreateUserDto) {
    if (!ADMIN_MANAGED_ROLES.includes(createDto.role)) {
      throw new BadRequestException('Admin users cannot be created here');
    }

    const onboardingStatus =
      createDto.onboardingStatus ?? OnboardingStatus.ACTIVE;

    if (!ADMIN_USER_STATUSES.includes(onboardingStatus)) {
      throw new BadRequestException(
        'User status must be ACTIVE or REJECTED',
      );
    }

    const email = createDto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await hash(createDto.password, 10);
    const name = createDto.name.trim();

    return this.prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role: createDto.role,
        onboardingStatus,
      },
      select: this.safeUserSelect,
    });
  }

  async createSalesExecutive(createDto: CreateSalesExecutiveDto) {
    const email = createDto.email.trim().toLowerCase();
    const seId = createDto.seId.trim();
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { seId }],
      },
    });

    if (existingUser?.email === email) {
      throw new ConflictException('Email is already registered');
    }

    if (existingUser?.seId === seId) {
      throw new ConflictException('SE ID is already registered');
    }

    const passwordHash = await hash(createDto.password, 10);

    return this.prisma.user.create({
      data: {
        name: seId,
        email,
        seId,
        password: passwordHash,
        role: UserRole.SALES_EXECUTIVE,
        onboardingStatus: OnboardingStatus.CREATED,
      },
      select: this.safeUserSelect,
    });
  }

  findPendingOnboardingRequests() {
    return this.prisma.user.findMany({
      where: {
        role: UserRole.SALES_EXECUTIVE,
        onboardingStatus: {
          in: PENDING_APPROVAL_STATUSES,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: this.safeUserSelect,
    });
  }

  async approveSalesExecutive(userId: string) {
    const user = await this.ensureSalesExecutive(userId);

    assertOnboardingStatus(
      user.onboardingStatus,
      APPROVABLE_ONBOARDING_STATUSES,
      'This sales executive is not pending approval',
    );

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingStatus: OnboardingStatus.PROFILE_INCOMPLETE,
      },
      select: this.safeUserSelect,
    });
  }

  async rejectSalesExecutive(userId: string) {
    const user = await this.ensureSalesExecutive(userId);

    assertOnboardingStatus(
      user.onboardingStatus,
      REJECTABLE_ONBOARDING_STATUSES,
      'This sales executive is not pending approval',
    );

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingStatus: OnboardingStatus.REJECTED,
      },
      select: this.safeUserSelect,
    });
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.safeUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async completeSalesProfile(
    userOrId: string | AuthenticatedUser,
    completeProfileDto: CompleteSalesProfileDto,
  ) {
    const userId = this.getSalesSelfServiceUserId(
      userOrId,
      'You are not allowed to complete this sales profile',
    );
    const user = await this.ensureSalesExecutive(userId);

    assertOnboardingStatus(
      user.onboardingStatus,
      PROFILE_COMPLETION_STATUSES,
      'Profile is not ready for completion',
    );

    const username = completeProfileDto.username.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    });

    if (existingUser && existingUser.id !== user.id) {
      throw new ConflictException('Username is already taken');
    }

    const firstName = completeProfileDto.firstName.trim();
    const lastName = completeProfileDto.lastName.trim();

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        username,
        phoneNumber: completeProfileDto.phoneNumber.trim(),
        dob: new Date(completeProfileDto.dob),
        gender: completeProfileDto.gender,
        onboardingStatus: OnboardingStatus.PASSWORD_CHANGE_REQUIRED,
      },
      select: this.safeUserSelect,
    });
  }

  async generatePasswordOtp(userOrId: string | AuthenticatedUser) {
    const userId = this.getSalesSelfServiceUserId(
      userOrId,
      'You are not allowed to generate a password OTP',
    );
    const user = await this.ensureSalesExecutive(userId);

    assertOnboardingStatus(
      user.onboardingStatus,
      PASSWORD_CHANGE_STATUSES,
      'Password change is not required now',
    );

    const { expiresAt } = await this.passwordResetOtpService.generateForUser(
      user.id,
    );

    return {
      expiresAt,
      message: 'OTP generated. Enter the OTP you received to change password.',
    };
  }

  async changePasswordWithOtp(
    userOrId: string | AuthenticatedUser,
    changePasswordDto: ChangePasswordWithOtpDto,
  ) {
    const userId = this.getSalesSelfServiceUserId(
      userOrId,
      'You are not allowed to change this password',
    );
    const user = await this.ensureSalesExecutive(userId);

    assertOnboardingStatus(
      user.onboardingStatus,
      PASSWORD_CHANGE_STATUSES,
      'Password change is not required now',
    );

    await this.passwordResetOtpService.assertValidOtp(
      user,
      changePasswordDto.otp,
      INVALID_OR_EXPIRED_OTP_MESSAGE,
    );

    const passwordHash = await hash(changePasswordDto.newPassword, 10);

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        ...this.passwordResetOtpService.getClearData(),
        onboardingStatus: OnboardingStatus.ACTIVE,
      },
      select: this.safeUserSelect,
    });
  }

  private async ensureSalesExecutive(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== UserRole.SALES_EXECUTIVE) {
      throw new NotFoundException('Sales executive not found');
    }

    return user;
  }

  private getSalesSelfServiceUserId(
    userOrId: string | AuthenticatedUser,
    message: string,
  ) {
    if (typeof userOrId === 'string') {
      return userOrId;
    }

    throwForbiddenUnless(canUseSalesSelfService(userOrId), message);

    return userOrId.userId;
  }

  private readonly safeUserSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    seId: true,
    username: true,
    firstName: true,
    lastName: true,
    phoneNumber: true,
    dob: true,
    gender: true,
    onboardingStatus: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.UserSelect;
}
