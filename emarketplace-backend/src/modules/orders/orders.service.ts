import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  BusinessRuleViolationError,
  MinimumOrderNotMetError,
  OutOfStockError,
  ResourceNotFoundError,
  ShopNotAcceptingOrdersError,
  VendorClosedError,
} from '../../common/errors/domain-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Address, Product, ProductVariant, Shop, UserRole } from '../../generated/prisma';
import { AuthPrincipal } from '../../common/auth/auth-principal.interface';
import { haversineKm } from '../../domain/geo';
import { Money } from '../../domain/money';
import { PricingService } from '../../domain/pricing.service';
import { ShopHoursService } from '../../domain/shop-hours/shop-hours.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersRepository, Tx } from './orders.repository';
import { OrderFinancialSnapshot, PlacedOrderResult, PricedOrderItem } from './order.types';

const DEFAULT_COMMISSION_RATE = '0.1500';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: OrdersRepository,
    private readonly pricing: PricingService,
    private readonly hours: ShopHoursService,
  ) {}

  /**
   * MULTI-VENDOR ORDER PLACEMENT & FINANCIAL SNAPSHOT.
   *
   * Everything below runs inside ONE interactive SERIALIZABLE transaction:
   *   1. Load + validate shop (approved, active, open-now in its own timezone).
   *   2. Load payout profile -> snapshot commission rate at placement time.
   *   3. Validate the delivery address belongs to the customer.
   *   4. Re-read products/variants INSIDE the tx and snapshot their prices —
   *      later vendor price edits can never mutate historical OrderItems.
   *   5. Compute subtotal, distance-based delivery fee, platform service fee,
   *      per-line taxes, total and netVendorPayout (all via Decimal money math).
   *   6. Deduct inventory with conditional UPDATEs (atomic; race-safe).
   *   7. Write Order + OrderItems + OrderTimeline(PENDING) as one graph.
   * Any failure rolls the entire unit back — no orphan stock deductions or
   * half-priced orders, ever.
   */
  async placeOrder(customer: AuthPrincipal, dto: CreateOrderDto): Promise<PlacedOrderResult> {
    if (customer.role !== UserRole.CUSTOMER && customer.role !== UserRole.ADMIN) {
      throw new BusinessRuleViolationError('ROLE_NOT_PERMITTED', 'Only customers can place orders');
    }

    return this.prisma.$transaction(
      async (tx) => this.placeOrderInTransaction(customer.userId, dto, tx),
      { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 15_000 },
    );
  }

  private async placeOrderInTransaction(customerId: number, dto: CreateOrderDto, tx: Tx): Promise<PlacedOrderResult> {
    // ---- 1. Shop gate -------------------------------------------------------
    const shop = await this.repository.findShopForOrder(dto.shopId, tx);
    if (!shop || !shop.isActive || !shop.isApproved) {
      throw new ShopNotAcceptingOrdersError(dto.shopId);
    }

    const operatingHours = await tx.shopOperatingHours.findMany({ where: { shopId: shop.id } });
    if (operatingHours.length > 0) {
      const openness = this.hours.isOpenNow(shop.timezone, operatingHours);
      if (!openness.isOpen) {
        throw new VendorClosedError(shop.id, openness.opensAtIso);
      }
    }

    // ---- 2. Commission snapshot --------------------------------------------
    const payout = await this.repository.findPayoutProfile(shop.id, tx);
    const commissionRate = payout?.commissionRate.toString() ?? DEFAULT_COMMISSION_RATE;
    const fixedCommission = payout ? Money.from(payout.fixedCommissionPerOrder) : Money.zero();

    // ---- 3. Delivery address ownership -------------------------------------
    const address = await this.repository.findCustomerAddress(dto.deliveryAddressId, customerId, tx);
    if (!address) {
      throw new ResourceNotFoundError('Delivery address', dto.deliveryAddressId);
    }

    // ---- 4. Price snapshots (products + variants re-read inside tx) --------
    const pricedItems = await this.buildPricedItems(dto, shop, tx);

    // ---- 5. Financial line items -------------------------------------------
    const financials = this.computeFinancials(shop, address, pricedItems, commissionRate, fixedCommission, dto);

    if (!financials.subtotal.gte(Money.from(shop.minimumOrderAmount))) {
      throw new MinimumOrderNotMetError(
        Money.from(shop.minimumOrderAmount).toString(),
        financials.subtotal.toString(),
      );
    }

    // ---- 6. Atomic inventory deduction --------------------------------------
    for (const item of pricedItems) {
      const variantId = item.variantId ?? (await this.defaultVariantId(item.productId, tx));
      const deducted = await this.repository.deductStock(item.productId, variantId, item.quantity, tx);
      if (!deducted) {
        throw new OutOfStockError(item.productId, item.quantity, 0, item.skuSnapshot ?? undefined);
      }
    }

    // ---- 7. Persist order graph (items + PENDING timeline) ------------------
    const orderNumber = generateOrderNumber();
    const etaMinutes = this.pricing.estimateEtaMinutes(
      financials.distanceKm,
      shop.averagePreparationTimeMinutes,
    );
    const estimatedDeliveryAt = new Date(Date.now() + etaMinutes * 60_000);

    const order = await this.repository.createOrderWithGraph(
      {
        orderNumber,
        customerId,
        shopId: shop.id,
        deliveryAddressId: address.id,
        currencyCode: financials.currencyCode,
        subtotal: financials.subtotal.toString(),
        deliveryFee: financials.deliveryFee.toString(),
        platformServiceFee: financials.platformServiceFee.toString(),
        platformCommissionRate: commissionRate,
        taxes: financials.taxes.toString(),
        discountTotal: financials.discountTotal.toString(),
        tipAmount: financials.tipAmount.toString(),
        totalAmount: financials.totalAmount.toString(),
        netVendorPayout: financials.netVendorPayout.toString(),
        deliveryRecipientName: address.recipientName,
        deliveryRecipientPhone: address.recipientPhone,
        deliveryLine1: address.line1,
        deliveryLine2: address.line2,
        deliveryCity: address.city,
        deliveryState: address.state,
        deliveryPostalCode: address.postalCode,
        deliveryCountryCode: address.countryCode,
        deliveryLatitude: address.latitude,
        deliveryLongitude: address.longitude,
        notes: dto.notes ?? null,
        estimatedDeliveryAt,
        items: pricedItems.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
          currencyCode: i.currencyCode,
          unitPrice: i.unitPrice.toString(),
          totalPrice: i.totalPrice.toString(),
          taxRate: i.taxRate,
          taxAmount: i.taxAmount.toString(),
          discountAmount: i.discountAmount.toString(),
          productNameSnapshot: i.productNameSnapshot,
          variantNameSnapshot: i.variantNameSnapshot,
          skuSnapshot: i.skuSnapshot,
          productImageSnapshot: i.productImageSnapshot,
          configurationSnapshot: i.configurationSnapshot,
          modifiersSnapshot: i.modifiersSnapshot,
        })),
      },
      tx,
    );

    this.logger.log(`Order ${orderNumber} placed by customer ${customerId}: total=${financials.totalAmount}`);

    return {
      orderId: order.id.toString(),
      orderNumber: order.orderNumber,
      status: 'PENDING',
      financials: {
        currencyCode: financials.currencyCode,
        subtotal: financials.subtotal,
        deliveryFee: financials.deliveryFee,
        platformServiceFee: financials.platformServiceFee,
        platformCommissionRate: commissionRate,
        taxes: financials.taxes,
        discountTotal: financials.discountTotal,
        tipAmount: financials.tipAmount,
        totalAmount: financials.totalAmount,
        netVendorPayout: financials.netVendorPayout,
      },
      items: pricedItems.map((i) => ({
        productId: i.productId,
        variantId: i.variantId?.toString() ?? null,
        quantity: i.quantity,
        unitPrice: i.unitPrice.toString(),
        totalPrice: i.totalPrice.toString(),
      })),
      estimatedDeliveryAt: estimatedDeliveryAt.toISOString(),
      placedAt: order.placedAt.toISOString(),
    };
  }

  /** Validate every line against live catalog state and freeze prices into snapshots. */
  private async buildPricedItems(dto: CreateOrderDto, shop: Shop, tx: Tx): Promise<PricedOrderItem[]> {
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.repository.findProductsByIds(productIds, dto.shopId, tx);
    const productById = new Map(products.map((p) => [p.id, p]));

    const variantIds = dto.items
      .filter((i) => i.variantId !== undefined)
      .map((i) => BigInt(i.variantId as number));
    const variants = variantIds.length > 0
      ? await this.repository.findVariantsByIds(variantIds, productIds, tx)
      : [];
    const variantById = new Map(variants.map((v) => [v.id.toString(), v]));

    const seen = new Set<string>();

    return dto.items.map((input) => {
      const product = productById.get(input.productId);
      if (!product) {
        throw new ResourceNotFoundError('Product', input.productId);
      }

      let variant: ProductVariant | null = null;
      if (input.variantId !== undefined) {
        variant = variantById.get(String(input.variantId)) ?? null;
        if (!variant || variant.productId !== product.id) {
          throw new ResourceNotFoundError('Product variant', input.variantId);
        }
        if (!variant.allowBackorder && product.trackInventory && variant.stockQuantity < input.quantity) {
          throw new OutOfStockError(product.id, input.quantity, variant.stockQuantity, variant.sku);
        }
      } else {
        // Single-SKU path requires an implicit default variant to hold stock.
        // Catalog policy guarantees >=1 variant per tracked product; pick lowest SKU.
      }

      const dedupeKey = `${String(input.productId)}:${variant ? variant.id.toString() : '-'}`;
      if (seen.has(dedupeKey)) {
        throw new BusinessRuleViolationError(
          'DUPLICATE_LINE',
          `Duplicate cart line for product ${String(input.productId)} — merge quantities instead`,
        );
      }
      seen.add(dedupeKey);

      // PRICE SNAPSHOT: base + variant offset captured now; future vendor edits are irrelevant.
      const unitPrice = Money.from(product.basePrice)
        .plus(variant ? Money.from(variant.priceOffset) : Money.zero())
        .round();
      const totalPrice = unitPrice.times(input.quantity).round();
      const { amount: taxAmount } = this.pricing.lineTax(totalPrice, null);

      return {
        productId: product.id,
        variantId: variant ? variant.id : null,
        quantity: input.quantity,
        unitPrice,
        totalPrice,
        taxRate: null,
        taxAmount,
        discountAmount: Money.zero(),
        currencyCode: product.currencyCode.trim() || shop.currencyCode.trim(),
        productNameSnapshot: product.name,
        variantNameSnapshot: variant?.name ?? null,
        skuSnapshot: variant?.sku ?? null,
        productImageSnapshot: variant?.imageUrl ?? product.imageUrl,
        configurationSnapshot: input.configuration ?? null,
        modifiersSnapshot: input.modifiers ?? null,
      } satisfies PricedOrderItem;
    });
  }

  /** Distance-based fees + commission + taxes + payout, all in exact decimal math. */
  private computeFinancials(
    shop: Shop,
    address: Address,
    items: readonly PricedOrderItem[],
    commissionRate: string,
    fixedCommission: Money,
    dto: CreateOrderDto,
  ): OrderFinancialSnapshot & { distanceKm: number } {
    const subtotal = items.reduce((acc, i) => acc.plus(i.totalPrice), Money.zero());
    const taxes = items.reduce((acc, i) => acc.plus(i.taxAmount), Money.zero());
    const discountTotal = items.reduce((acc, i) => acc.plus(i.discountAmount), Money.zero());

    const distanceKm = haversineKm(
      { latitude: shop.latitude, longitude: shop.longitude },
      { latitude: address.latitude, longitude: address.longitude },
    );

    const deliveryFee = this.pricing.deliveryFeeForDistance(distanceKm);
    const platformServiceFee = this.pricing
      .platformServiceFee(subtotal, commissionRate, fixedCommission.toString())
      .round();
    const tipAmount = parseTip(dto.tipAmount);
    const totalAmount = subtotal.plus(taxes).plus(deliveryFee).plus(tipAmount).minus(discountTotal).round();
    const netVendorPayout = this.pricing.netVendorPayout(subtotal, platformServiceFee);

    return {
      currencyCode: items[0]?.currencyCode ?? shop.currencyCode.trim(),
      subtotal,
      deliveryFee,
      platformServiceFee,
      platformCommissionRate: commissionRate,
      taxes,
      discountTotal,
      tipAmount,
      totalAmount,
      netVendorPayout,
      distanceKm,
    };
  }

  /** For trackInventory products ordered without an explicit variant, deduct from the default variant. */
  private async defaultVariantId(productId: number, tx: Tx): Promise<bigint> {
    const variant = await tx.productVariant.findFirst({
      where: { productId, isActive: true },
      orderBy: { sku: 'asc' },
    });
    if (!variant) {
      throw new BusinessRuleViolationError(
        'NO_VARIANT',
        `Product ${String(productId)} has no purchasable variant configured`,
      );
    }
    return variant.id as bigint;
  }
}

function parseTip(raw: string | undefined): Money {
  if (raw === undefined || raw === '') {
    return Money.zero();
  }
  let money: Money;
  try {
    money = Money.from(raw);
  } catch {
    throw new BusinessRuleViolationError('INVALID_TIP', 'tipAmount must be a valid decimal amount');
  }
  if (!money.isPositive() && money.toString() !== '0.00') {
    throw new BusinessRuleViolationError('INVALID_TIP', 'tipAmount cannot be negative');
  }
  return money.round();
}

/**
 * Public-facing order number: ORD-<base36 timestamp>-<8 random chars>.
 * Unique index on orderNumber makes collisions a hard (retried) failure.
 */
function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = randomBytes(4).toString('hex').toUpperCase();
  return `ORD-${ts}-${rnd}`;
}
