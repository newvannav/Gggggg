import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { GeoPointDto } from '../../../common/dto/geo.dto';

/**
 * GET /shops/nearby?latitude=..&longitude=..&radiusKm=..
 * Radius bounded to [0.1, 50] km — larger scans are a DoS vector against
 * distance math and should go through a dedicated search service instead.
 */
export class NearbyShopsQueryDto extends GeoPointDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'radiusKm must be a number' })
  @Min(0.1, { message: 'radiusKm must be at least 0.1' })
  @Max(50, { message: 'radiusKm must be at most 50' })
  radiusKm!: number;

  /** Optional cap on the returned result set (nearest-first). */
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: 'limit must be a number' })
  @Min(1)
  @Max(50)
  limit?: number;
}
