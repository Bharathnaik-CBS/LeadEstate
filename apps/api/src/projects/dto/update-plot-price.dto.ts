import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdatePlotPriceDto {
  @Transform(({ value }) => {
    if (typeof value === 'number') {
      return value.toString();
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    return value;
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'newPrice must be a decimal value with up to 2 decimal places',
  })
  newPrice: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
