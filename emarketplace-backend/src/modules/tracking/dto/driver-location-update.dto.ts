import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Body for PATCH /orders/:id/tracking.
 * Coordinate bounds are enforced at the edge; the service additionally
 * rejects "null island" (0,0) placeholders and enforces ownership checks.
 */
export class DriverLocationUpdateDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 }, { message: 'currentDriverLat must be a number with <= 7 decimal places' })
  @Min(-90, { message: 'currentDriverLat must be between -90 and 90' })
  @Max(90, { message: 'currentDriverLat must be between -90 and 90' })
  currentDriverLat!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 }, { message: 'currentDriverLng must be a number with <= 7 decimal places' })
  @Min(-180, { message: 'currentDriverLng must be between -180 and 180' })
  @Max(180, { message: 'currentDriverLng must be between -180 and 180' })
  currentDriverLng!: number;

  /** Optional driver-estimated minutes to drop-off; clamped to a sane range. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  driverEtaMinutes?: number;
}
