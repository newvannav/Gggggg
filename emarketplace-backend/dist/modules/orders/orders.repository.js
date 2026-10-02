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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let OrdersRepository = class OrdersRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    db(tx) {
        return tx ?? this.prisma;
    }
    findShopForOrder(shopId, tx) {
        return this.db(tx).shop.findFirst({
            where: { id: shopId, deletedAt: null },
        });
    }
    findPayoutProfile(shopId, tx) {
        return this.db(tx).vendorPayoutProfile.findUnique({
            where: { shopId },
        });
    }
    findCustomerAddress(addressId, customerId, tx) {
        return this.db(tx).address.findFirst({
            where: { id: addressId, userId: customerId, isActive: true },
        });
    }
    findProductsByIds(productIds, shopId, tx) {
        return this.db(tx).product.findMany({
            where: {
                id: { in: [...productIds] },
                shopId,
                isActive: true,
                deletedAt: null,
            },
        });
    }
    findVariantsByIds(variantIds, productIds, tx) {
        return this.db(tx).productVariant.findMany({
            where: {
                id: { in: [...variantIds] },
                productId: { in: [...productIds] },
                isActive: true,
            },
        });
    }
    async deductStock(productId, variantId, quantity, tx) {
        const updated = await this.db(tx).$executeRaw `
      UPDATE product_variants
      SET "stockQuantity" = "stockQuantity" - ${quantity},
          "updatedAt" = now()
      WHERE id = ${variantId}
        AND "productId" = ${productId}
        AND "stockQuantity" >= ${quantity}
    `;
        return updated === 1;
    }
    createOrderWithGraph(data, tx) {
        const { items, ...orderFields } = data;
        return this.db(tx).order.create({
            data: {
                ...orderFields,
                status: 'PENDING',
                paymentStatus: 'UNPAID',
                items: { create: items },
                timeline: {
                    create: [{ status: 'PENDING', previousStatus: null, note: 'Order placed', occurredAt: new Date() }],
                },
            },
        });
    }
    findOrderById(orderId, tx) {
        return this.db(tx).order.findUnique({ where: { id: orderId } });
    }
};
exports.OrdersRepository = OrdersRepository;
exports.OrdersRepository = OrdersRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrdersRepository);
//# sourceMappingURL=orders.repository.js.map