import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelSiteVisitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  cancellationReason: string;
}
