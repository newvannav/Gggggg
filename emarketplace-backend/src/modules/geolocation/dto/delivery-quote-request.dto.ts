import { Type } from 'class-transformer';
import { IsInt, Min, ValidateNested } from 'class-validator';
import { GeoPointDto } from '../../../common/dto/geo.dto';

/** POST /shops/delivery-quote body. */
export class DeliveryQuoteRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'shopId must be a positive integer' })
  shopId!: number;

  /** The customer's current/pickup location for the fee calculation. */
  @Type(() => GeoPointDto)
  @ValidateNested()
  userLocation!: GeoPointDto;
}
