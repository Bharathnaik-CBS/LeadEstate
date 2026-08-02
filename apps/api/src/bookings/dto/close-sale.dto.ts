import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloseSaleDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  closureNotes?: string;
}
