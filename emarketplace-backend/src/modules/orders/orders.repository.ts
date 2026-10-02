import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Order, Product, ProductVariant, Shop, VendorPayoutProfile } from '../../generated/prisma';

/**
 * Data-access layer for everything order placement touches.
 * All methods accept an optional `tx` (interactive transaction client) so the
 * service can pin every read/write to the SAME SERIALIZABLE transaction —
 * critical for the atomic stock-deduction guarantee.
 */
import { Prisma } from '../../generated/prisma';

/** Interactive transaction client handed to every repository call inside the order-placement flow. */
export type Tx = Prisma.TransactionClient;

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Tx): PrismaService | Tx {
    return tx ?? this.prisma;
  }

  findShopForOrder(shopId: number, tx?: Tx): Promise<Shop | null> {
    return this.db(tx).shop.findFirst({
      where: { id: shopId, deletedAt: null },
    }) as Promise<Shop | null>;
  }

  findPayoutProfile(shopId: number, tx?: Tx): Promise<VendorPayoutProfile | null> {
    return this.db(tx).vendorPayoutProfile.findUnique({
      where: { shopId },
    }) as Promise<VendorPayoutProfile | null>;
  }

  /** Delivery address must belong to the requesting customer and be active. */
  findCustomerAddress(addressId: number, customerId: number, tx?: Tx) {
    return this.db(tx).address.findFirst({
      where: { id: addressId, userId: customerId, isActive: true },
    });
  }

  findProductsByIds(productIds: readonly number[], shopId: number, tx?: Tx): Promise<Product[]> {
    return this.db(tx).product.findMany({
      where: {
        id: { in: [...productIds] },
        shopId, // cross-shop item injection is impossible by construction
        isActive: true,
        deletedAt: null,
      },
    }) as Promise<Product[]>;
  }

  findVariantsByIds(variantIds: readonly bigint[], productIds: readonly number[], tx?: Tx): Promise<ProductVariant[]> {
    return this.db(tx).productVariant.findMany({
      where: {
        id: { in: [...variantIds] },
        productId: { in: [...productIds] },
        isActive: true,
      },
    }) as Promise<ProductVariant[]>;
  }

  /**
   * ATOMIC inventory deduction.
   *
   * The conditional `stockQuantity >= quantity` predicate means Postgres row
   * locks serialize concurrent buyers on the same SKU: if count === 0 the
   * stock was taken while we were pricing and the caller aborts the whole
   * transaction with a clean OUT_OF_STOCK error. No lost updates, no
   * negative stock (the CHECK constraint in migration is the final backstop).
   */
  async deductStock(productId: number, variantId: bigint, quantity: number, tx: Tx): Promise<boolean> {
    const updated = await this.db(tx).$executeRaw`
      UPDATE product_variants
      SET "stockQuantity" = "stockQuantity" - ${quantity},
          "updatedAt" = now()
      WHERE id = ${variantId}
        AND "productId" = ${productId}
        AND "stockQuantity" >= ${quantity}
    `;
    return updated === 1;
  }

  createOrderWithGraph(
    data: {
      orderNumber: string;
      customerId: number;
      shopId: number;
      deliveryAddressId: number;
      currencyCode: string;
      subtotal: string;
      deliveryFee: string;
      platformServiceFee: string;
      platformCommissionRate: string;
      taxes: string;
      discountTotal: string;
      tipAmount: string;
      totalAmount: string;
      netVendorPayout: string;
      deliveryRecipientName: string;
      deliveryRecipientPhone: string | null;
      deliveryLine1: string;
      deliveryLine2: string | null;
      deliveryCity: string;
      deliveryState: string | null;
      deliveryPostalCode: string;
      deliveryCountryCode: string;
      deliveryLatitude: number;
      deliveryLongitude: number;
      notes: string | null;
      estimatedDeliveryAt: Date | null;
      items: Array<{
        productId: number;
        variantId: bigint | null;
        quantity: number;
        currencyCode: string;
        unitPrice: string;
        totalPrice: string;
        taxRate: string | null;
        taxAmount: string;
        discountAmount: string;
        productNameSnapshot: string;
        variantNameSnapshot: string | null;
        skuSnapshot: string | null;
        productImageSnapshot: string | null;
        configurationSnapshot: Record<string, unknown> | null;
        modifiersSnapshot: Record<string, unknown> | null;
      }>;
    },
    tx: Tx,
  ): Promise<Order> {
    const { items, ...orderFields } = data;

    return this.db(tx).order.create({
      data: {
        ...orderFields,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        items: { create: items },
        // Timeline seeded at PENDING inside the same atomic write graph.
        timeline: {
          create: [{ status: 'PENDING', previousStatus: null, note: 'Order placed', occurredAt: new Date() }],
        },
      },
    }) as Promise<Order>;
  }

  findOrderById(orderId: bigint, tx?: Tx): Promise<Order | null> {
    return this.db(tx).order.findUnique({ where: { id: orderId } }) as Promise<Order | null>;
  }
}
