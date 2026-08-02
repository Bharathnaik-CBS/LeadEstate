import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  AllowAnyOnboardingStatus,
  AllowOnboardingStatuses,
} from '../auth/decorators/onboarding-statuses.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';
import { OnboardingStatus } from '../generated/prisma/client';
import { ChangePasswordWithOtpDto } from './dto/change-password-with-otp.dto';
import { CompleteSalesProfileDto } from './dto/complete-sales-profile.dto';
import { CreateSalesExecutiveDto } from './dto/create-sales-executive.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListSalesExecutivesDto } from './dto/list-sales-executives.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('sales-executives')
  @Permissions(PERMISSIONS.SALES_EXECUTIVES.VIEW_ACTIVE)
  findSalesExecutives() {
    return this.usersService.findSalesExecutives();
  }

  @Get('sales-executives/manage')
  @Permissions(PERMISSIONS.SALES_EXECUTIVES.MANAGE)
  findSalesExecutivesForManagement(@Query() query: ListSalesExecutivesDto) {
    return this.usersService.findSalesExecutivesForManagement(
      query.onboardingStatus,
    );
  }

  @Post('sales-executives')
  @Permissions(PERMISSIONS.SALES_EXECUTIVES.CREATE)
  createSalesExecutive(@Body() createDto: CreateSalesExecutiveDto) {
    return this.usersService.createSalesExecutive(createDto);
  }

  @Get('manage')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  findManagedUsers(@Query() query: ListUsersDto) {
    return this.usersService.findManagedUsers(query);
  }

  @Post()
  @Permissions(PERMISSIONS.USERS.CREATE)
  createUser(@Body() createDto: CreateUserDto) {
    return this.usersService.createUser(createDto);
  }

  @Get('onboarding/pending')
  @Permissions(PERMISSIONS.SALES_EXECUTIVES.MANAGE)
  findPendingOnboardingRequests() {
    return this.usersService.findPendingOnboardingRequests();
  }

  @Get('me')
  @Permissions(PERMISSIONS.USERS.VIEW_OWN_PROFILE)
  @AllowAnyOnboardingStatus()
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findMe(user.userId);
  }

  @Patch('me/profile')
  @Permissions(PERMISSIONS.USERS.UPDATE_OWN_PROFILE)
  @AllowOnboardingStatuses(OnboardingStatus.PROFILE_INCOMPLETE)
  completeSalesProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() completeProfileDto: CompleteSalesProfileDto,
  ) {
    return this.usersService.completeSalesProfile(
      user,
      completeProfileDto,
    );
  }

  @Post('me/password-otp')
  @Permissions(PERMISSIONS.USERS.CHANGE_OWN_PASSWORD)
  @AllowOnboardingStatuses(OnboardingStatus.PASSWORD_CHANGE_REQUIRED)
  generatePasswordOtp(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.generatePasswordOtp(user);
  }

  @Post('me/change-password')
  @Permissions(PERMISSIONS.USERS.CHANGE_OWN_PASSWORD)
  @AllowOnboardingStatuses(OnboardingStatus.PASSWORD_CHANGE_REQUIRED)
  changePasswordWithOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changePasswordDto: ChangePasswordWithOtpDto,
  ) {
    return this.usersService.changePasswordWithOtp(
      user,
      changePasswordDto,
    );
  }

  @Patch(':id/onboarding/approve')
  @Permissions(PERMISSIONS.SALES_EXECUTIVES.APPROVE_ONBOARDING)
  approveSalesExecutive(@Param('id') id: string) {
    return this.usersService.approveSalesExecutive(id);
  }

  @Patch(':id/onboarding/reject')
  @Permissions(PERMISSIONS.SALES_EXECUTIVES.REJECT_ONBOARDING)
  rejectSalesExecutive(@Param('id') id: string) {
    return this.usersService.rejectSalesExecutive(id);
  }
}
