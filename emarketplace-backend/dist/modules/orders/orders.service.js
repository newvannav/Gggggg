"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const domain_errors_1 = require("../../common/errors/domain-errors");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const prisma_1 = require("../../generated/prisma");
const geo_1 = require("../../domain/geo");
const money_1 = require("../../domain/money");
const pricing_service_1 = require("../../domain/pricing.service");
const shop_hours_service_1 = require("../../domain/shop-hours/shop-hours.service");
const orders_repository_1 = require("./orders.repository");
const DEFAULT_COMMISSION_RATE = '0.1500';
let OrdersService = OrdersService_1 = class OrdersService {
    prisma;
    repository;
    pricing;
    hours;
    logger = new common_1.Logger(OrdersService_1.name);
    constructor(prisma, repository, pricing, hours) {
        this.prisma = prisma;
        this.repository = repository;
        this.pricing = pricing;
        this.hours = hours;
    }
    async placeOrder(customer, dto) {
        if (customer.role !== prisma_1.UserRole.CUSTOMER && customer.role !== prisma_1.UserRole.ADMIN) {
            throw new domain_errors_1.BusinessRuleViolationError('ROLE_NOT_PERMITTED', 'Only customers can place orders');
        }
        return this.prisma.$transaction(async (tx) => this.placeOrderInTransaction(customer.userId, dto, tx), { isolationLevel: 'SERIALIZABLE', maxWait: 5_000, timeout: 15_000 });
    }
    async placeOrderInTransaction(customerId, dto, tx) {
        const shop = await this.repository.findShopForOrder(dto.shopId, tx);
        if (!shop || !shop.isActive || !shop.isApproved) {
            throw new domain_errors_1.ShopNotAcceptingOrdersError(dto.shopId);
        }
        const operatingHours = await tx.shopOperatingHours.findMany({ where: { shopId: shop.id } });
        if (operatingHours.length > 0) {
            const openness = this.hours.isOpenNow(shop.timezone, operatingHours);
            if (!openness.isOpen) {
                throw new domain_errors_1.VendorClosedError(shop.id, openness.opensAtIso);
            }
        }
        const payout = await this.repository.findPayoutProfile(shop.id, tx);
        const commissionRate = payout?.commissionRate.toString() ?? DEFAULT_COMMISSION_RATE;
        const fixedCommission = payout ? money_1.Money.from(payout.fixedCommissionPerOrder) : money_1.Money.zero();
        const address = await this.repository.findCustomerAddress(dto.deliveryAddressId, customerId, tx);
        if (!address) {
            throw new domain_errors_1.ResourceNotFoundError('Delivery address', dto.deliveryAddressId);
        }
        const pricedItems = await this.buildPricedItems(dto, shop, tx);
        const financials = this.computeFinancials(shop, address, pricedItems, commissionRate, fixedCommission, dto);
        if (!financials.subtotal.gte(money_1.Money.from(shop.minimumOrderAmount))) {
            throw new domain_errors_1.MinimumOrderNotMetError(money_1.Money.from(shop.minimumOrderAmount).toString(), financials.subtotal.toString());
        }
        for (const item of pricedItems) {
            const variantId = item.variantId ?? (await this.defaultVariantId(item.productId, tx));
            const deducted = await this.repository.deductStock(item.productId, variantId, item.quantity, tx);
            if (!deducted) {
                throw new domain_errors_1.OutOfStockError(item.productId, item.quantity, 0, item.skuSnapshot ?? undefined);
            }
        }
        const orderNumber = generateOrderNumber();
        const etaMinutes = this.pricing.estimateEtaMinutes(financials.distanceKm, shop.averagePreparationTimeMinutes);
        const estimatedDeliveryAt = new Date(Date.now() + etaMinutes * 60_000);
        const order = await this.repository.createOrderWithGraph({
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
        }, tx);
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
    async buildPricedItems(dto, shop, tx) {
        const productIds = [...new Set(dto.items.map((i) => i.productId))];
        const products = await this.repository.findProductsByIds(productIds, dto.shopId, tx);
        const productById = new Map(products.map((p) => [p.id, p]));
        const variantIds = dto.items
            .filter((i) => i.variantId !== undefined)
            .map((i) => BigInt(i.variantId));
        const variants = variantIds.length > 0
            ? await this.repository.findVariantsByIds(variantIds, productIds, tx)
            : [];
        const variantById = new Map(variants.map((v) => [v.id.toString(), v]));
        const seen = new Set();
        return dto.items.map((input) => {
            const product = productById.get(input.productId);
            if (!product) {
                throw new domain_errors_1.ResourceNotFoundError('Product', input.productId);
            }
            let variant = null;
            if (input.variantId !== undefined) {
                variant = variantById.get(String(input.variantId)) ?? null;
                if (!variant || variant.productId !== product.id) {
                    throw new domain_errors_1.ResourceNotFoundError('Product variant', input.variantId);
                }
                if (!variant.allowBackorder && product.trackInventory && variant.stockQuantity < input.quantity) {
                    throw new domain_errors_1.OutOfStockError(product.id, input.quantity, variant.stockQuantity, variant.sku);
                }
            }
            else {
            }
            const dedupeKey = `${String(input.productId)}:${variant ? variant.id.toString() : '-'}`;
            if (seen.has(dedupeKey)) {
                throw new domain_errors_1.BusinessRuleViolationError('DUPLICATE_LINE', `Duplicate cart line for product ${String(input.productId)} — merge quantities instead`);
            }
            seen.add(dedupeKey);
            const unitPrice = money_1.Money.from(product.basePrice)
                .plus(variant ? money_1.Money.from(variant.priceOffset) : money_1.Money.zero())
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
                discountAmount: money_1.Money.zero(),
                currencyCode: product.currencyCode.trim() || shop.currencyCode.trim(),
                productNameSnapshot: product.name,
                variantNameSnapshot: variant?.name ?? null,
                skuSnapshot: variant?.sku ?? null,
                productImageSnapshot: variant?.imageUrl ?? product.imageUrl,
                configurationSnapshot: input.configuration ?? null,
                modifiersSnapshot: input.modifiers ?? null,
            };
        });
    }
    computeFinancials(shop, address, items, commissionRate, fixedCommission, dto) {
        const subtotal = items.reduce((acc, i) => acc.plus(i.totalPrice), money_1.Money.zero());
        const taxes = items.reduce((acc, i) => acc.plus(i.taxAmount), money_1.Money.zero());
        const discountTotal = items.reduce((acc, i) => acc.plus(i.discountAmount), money_1.Money.zero());
        const distanceKm = (0, geo_1.haversineKm)({ latitude: shop.latitude, longitude: shop.longitude }, { latitude: address.latitude, longitude: address.longitude });
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
    async defaultVariantId(productId, tx) {
        const variant = await tx.productVariant.findFirst({
            where: { productId, isActive: true },
            orderBy: { sku: 'asc' },
        });
        if (!variant) {
            throw new domain_errors_1.BusinessRuleViolationError('NO_VARIANT', `Product ${String(productId)} has no purchasable variant configured`);
        }
        return variant.id;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        orders_repository_1.OrdersRepository,
        pricing_service_1.PricingService,
        shop_hours_service_1.ShopHoursService])
], OrdersService);
function parseTip(raw) {
    if (raw === undefined || raw === '') {
        return money_1.Money.zero();
    }
    let money;
    try {
        money = money_1.Money.from(raw);
    }
    catch {
        throw new domain_errors_1.BusinessRuleViolationError('INVALID_TIP', 'tipAmount must be a valid decimal amount');
    }
    if (!money.isPositive() && money.toString() !== '0.00') {
        throw new domain_errors_1.BusinessRuleViolationError('INVALID_TIP', 'tipAmount cannot be negative');
    }
    return money.round();
}
function generateOrderNumber() {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = (0, node_crypto_1.randomBytes)(4).toString('hex').toUpperCase();
    return `ORD-${ts}-${rnd}`;
}
//# sourceMappingURL=orders.service.js.map