import { Money } from '../../../domain/money';

/** Financial line items frozen onto the Order row at placement time. */
export interface OrderFinancialSnapshot {
  readonly currencyCode: string;
  readonly subtotal: Money;
  readonly deliveryFee: Money;
  readonly platformServiceFee: Money;
  readonly platformCommissionRate: string;
  readonly taxes: Money;
  readonly discountTotal: Money;
  readonly tipAmount: Money;
  readonly totalAmount: Money;
  readonly netVendorPayout: Money;
}

/** A validated, priced cart line ready to be persisted as an OrderItem. */
export interface PricedOrderItem {
  readonly productId: number;
  readonly variantId: bigint | null;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly totalPrice: Money;
  readonly taxRate: string | null;
  readonly taxAmount: Money;
  readonly discountAmount: Money;
  readonly currencyCode: string;
  readonly productNameSnapshot: string;
  readonly variantNameSnapshot: string | null;
  readonly skuSnapshot: string | null;
  readonly productImageSnapshot: string | null;
  readonly configurationSnapshot: Record<string, unknown> | null;
  readonly modifiersSnapshot: Record<string, unknown> | null;
}

export interface PlacedOrderResult {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: 'PENDING';
  readonly financials: OrderFinancialSnapshot;
  readonly items: ReadonlyArray<{
    productId: number;
    variantId: string | null;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }>;
  readonly estimatedDeliveryAt: string | null;
  readonly placedAt: string;
}
