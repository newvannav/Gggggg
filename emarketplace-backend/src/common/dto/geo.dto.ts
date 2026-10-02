import { Type } from 'class-transformer';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

/**
 * Shared coordinate DTO reused by query + body objects.
 * class-validator enforces geodetic bounds; the service layer additionally
 * rejects (0,0)-style "null island" placeholders via domain guards.
 */
export class GeoPointDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 }, { message: 'latitude must be a number with <= 7 decimal places' })
  @Min(-90, { message: 'latitude must be between -90 and 90' })
  @Max(90, { message: 'latitude must be between -90 and 90' })
  latitude!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 }, { message: 'longitude must be a number with <= 7 decimal places' })
  @Min(-180, { message: 'longitude must be between -180 and 180' })
  @Max(180, { message: 'longitude must be between -180 and 180' })
  longitude!: number;
}

export class PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
