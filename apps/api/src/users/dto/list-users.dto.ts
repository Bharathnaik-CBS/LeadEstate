import { IsEnum, IsOptional } from 'class-validator';
import { OnboardingStatus, UserRole } from '../../generated/prisma/client';

export class ListUsersDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(OnboardingStatus)
  onboardingStatus?: OnboardingStatus;
}
