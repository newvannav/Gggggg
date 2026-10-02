import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderItemInputDto } from './order-item-input.dto';

/**
 * POST /orders body.
 *
 * One order targets exactly one shop (multi-vendor carts are split into one
 * order per vendor upstream by the client's cart orchestrator).
 */
export class CreateOrderDto {
  @Type(() => Number)
  @IsInt({ message: 'shopId must be an integer' })
  @Min(1, { message: 'shopId must be a positive integer' })
  shopId!: number;

  /** addresses.id — must belong to the authenticated customer (enforced in service). */
  @Type(() => Number)
  @IsInt({ message: 'deliveryAddressId must be an integer' })
  @Min(1)
  deliveryAddressId!: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'An order needs at least one line item' })
  @ArrayMaxSize(100, { message: 'An order cannot exceed 100 line items' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'notes must be at most 2000 characters' })
  notes?: string;

  /** Optional tip for the driver, decimal-string to avoid FP drift. Validated in service via Money. */
  @IsOptional()
  @IsString({ message: 'tipAmount must be a decimal string' })
  @MaxLength(16)
  tipAmount?: string;
}
