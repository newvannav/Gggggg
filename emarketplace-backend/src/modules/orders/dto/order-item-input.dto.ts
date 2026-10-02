import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

/**
 * One cart line. Exactly one of productId (no variant) or variantId identifies
 * the SKU; cross-shop items are rejected because all lines must resolve to
 * products owned by the order's shop.
 */
export class OrderItemInputDto {
  @Type(() => Number)
  @IsInt({ message: 'productId must be an integer' })
  @Min(1)
  productId!: number;

  /** product_variants.id (BigInt in schema). Omit for single-SKU products. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'variantId must be an integer' })
  @Min(1)
  variantId?: number;

  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity!: number;

  /** Free-form configuration captured verbatim into OrderItem.configurationSnapshot. */
  @IsOptional()
  @IsObject({ message: 'configuration must be a JSON object' })
  configuration?: Record<string, unknown>;

  /** Chosen modifiers/options captured into OrderItem.modifiersSnapshot. */
  @IsOptional()
  @IsObject({ message: 'modifiers must be a JSON object' })
  modifiers?: Record<string, unknown>;
}
