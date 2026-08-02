import { IsEnum, IsOptional } from 'class-validator';
import { OnboardingStatus } from '../../generated/prisma/client';

export class ListSalesExecutivesDto {
  @IsOptional()
  @IsEnum(OnboardingStatus)
  onboardingStatus?: OnboardingStatus;
}
