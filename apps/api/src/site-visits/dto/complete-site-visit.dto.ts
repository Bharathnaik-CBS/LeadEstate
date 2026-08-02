import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteSiteVisitDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  outcomeNotes?: string;
}
