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
var TrackingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingService = void 0;
const common_1 = require("@nestjs/common");
const domain_errors_1 = require("../../common/errors/domain-errors");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const prisma_1 = require("../../generated/prisma");
const order_status_machine_1 = require("../../domain/order-status.machine");
const TRACKABLE_STATUSES = new Set([prisma_1.OrderStatus.OUT_FOR_DELIVERY]);
const DRIVER_ALLOWED_TARGETS = new Set([
    prisma_1.OrderStatus.OUT_FOR_DELIVERY,
    prisma_1.OrderStatus.DELIVERED,
]);
let TrackingService = TrackingService_1 = class TrackingService {
    prisma;
    logger = new common_1.Logger(TrackingService_1.name);
    io = null;
    constructor(prisma) {
        this.prisma = prisma;
    }
    setSocketServer(io) {
        this.io = io;
    }
    async updateDriverLocation(orderId, dto, actor) {
        if (actor.role !== prisma_1.UserRole.DRIVER && actor.role !== prisma_1.UserRole.ADMIN) {
            throw new domain_errors_1.ForbiddenError('Only assigned drivers can push location updates');
        }
        if (dto.currentDriverLat === 0 && dto.currentDriverLng === 0) {
            throw new domain_errors_1.InvalidCoordinatesError('Driver reported placeholder coordinates (0,0)');
        }
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, driverId: true, status: true, customerId: true },
        });
        if (!order) {
            throw new domain_errors_1.ResourceNotFoundError("Order", orderId.toString());
        }
        if (actor.role !== prisma_1.UserRole.ADMIN && order.driverId !== actor.userId) {
            throw new domain_errors_1.ForbiddenError('You are not the assigned driver for this order');
        }
        if (!TRACKABLE_STATUSES.has(order.status)) {
            throw new domain_errors_1.BusinessRuleViolationError('ORDER_NOT_TRACKABLE', `Order in status ${order.status} does not accept live location updates`);
        }
        const now = new Date();
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                driverLatitude: dto.currentDriverLat,
                driverLongitude: dto.currentDriverLng,
                driverLocationUpdatedAt: now,
                ...(dto.driverEtaMinutes !== undefined ? { driverEtaMinutes: dto.driverEtaMinutes } : {}),
            },
        });
        const event = {
            type: 'LOCATION_UPDATE',
            orderId: orderId.toString(),
            currentDriverLat: dto.currentDriverLat,
            currentDriverLng: dto.currentDriverLng,
            driverEtaMinutes: dto.driverEtaMinutes ?? null,
            updatedAt: now.toISOString(),
        };
        const recipients = this.broadcast(orderId, event);
        return { orderId: orderId.toString(), acceptedAt: now.toISOString(), broadcastRecipients: recipients };
    }
    async transitionStatus(orderId, to, actor, note) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, driverId: true, shopId: true, customerId: true, status: true },
        });
        if (!order) {
            throw new domain_errors_1.ResourceNotFoundError("Order", orderId.toString());
        }
        if (actor.role === prisma_1.UserRole.DRIVER) {
            if (order.driverId !== actor.userId) {
                throw new domain_errors_1.ForbiddenError('You are not the assigned driver for this order');
            }
            if (!DRIVER_ALLOWED_TARGETS.has(to)) {
                throw new domain_errors_1.ForbiddenError(`Drivers cannot transition orders to ${to}`);
            }
        }
        else if (actor.role === prisma_1.UserRole.VENDOR) {
            if (actor.shopId === undefined || order.shopId !== actor.shopId) {
                throw new domain_errors_1.ForbiddenError('This order does not belong to your shop');
            }
        }
        else if (actor.role !== prisma_1.UserRole.ADMIN) {
            throw new domain_errors_1.ForbiddenError('Only vendors, drivers or admins can change order status');
        }
        const from = order.status;
        if ((0, order_status_machine_1.isTerminal)(from)) {
            throw new domain_errors_1.BusinessRuleViolationError('ORDER_TERMINAL', `Order already in terminal status ${from}`);
        }
        (0, order_status_machine_1.assertTransition)(from, to);
        const occurredAt = new Date();
        await this.prisma.$transaction([
            this.prisma.order.update({
                where: { id: orderId },
                data: this.statusTimestampPatch(to, occurredAt),
            }),
            this.prisma.orderTimeline.create({
                data: {
                    orderId,
                    status: to,
                    previousStatus: from,
                    changedById: actor.userId,
                    ...(note !== undefined ? { note } : {}),
                    occurredAt,
                },
            }),
        ]);
        const event = {
            type: 'STATUS_CHANGE',
            orderId: orderId.toString(),
            status: to,
            previousStatus: from,
            occurredAt: occurredAt.toISOString(),
        };
        this.broadcast(orderId, event);
        return event;
    }
    async getTrackingSnapshot(orderId, viewer) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                customerId: true,
                driverId: true,
                driverLatitude: true,
                driverLongitude: true,
                driverLocationUpdatedAt: true,
                driverEtaMinutes: true,
                deliveryLatitude: true,
                deliveryLongitude: true,
                estimatedDeliveryAt: true,
            },
        });
        if (!order) {
            throw new domain_errors_1.ResourceNotFoundError("Order", orderId.toString());
        }
        const isParty = viewer.role === prisma_1.UserRole.ADMIN ||
            viewer.userId === order.customerId ||
            viewer.userId === order.driverId;
        if (!isParty) {
            throw new domain_errors_1.ForbiddenError('Not authorized to view this order tracking');
        }
        return order;
    }
    statusTimestampPatch(status, at) {
        switch (status) {
            case prisma_1.OrderStatus.ACCEPTED_BY_SHOP:
                return { status, acceptedAt: at };
            case prisma_1.OrderStatus.PREPARING:
                return { status, preparingAt: at };
            case prisma_1.OrderStatus.AWAITING_PICKUP:
                return { status, awaitingPickupAt: at };
            case prisma_1.OrderStatus.OUT_FOR_DELIVERY:
                return { status, outForDeliveryAt: at };
            case prisma_1.OrderStatus.DELIVERED:
                return { status, deliveredAt: at };
            case prisma_1.OrderStatus.CANCELLED:
                return { status, cancelledAt: at };
            default:
                return { status };
        }
    }
    broadcast(orderId, event) {
        if (!this.io) {
            this.logger.warn(`Socket.IO server not attached; skipped broadcast for order ${orderId}`);
            return 0;
        }
        this.io.to(`order-${orderId}`).emit('tracking', event);
        return this.io.sockets.adapter.rooms.get(`order-${orderId}`)?.size ?? 0;
    }
};
exports.TrackingService = TrackingService;
exports.TrackingService = TrackingService = TrackingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TrackingService);
//# sourceMappingURL=tracking.service.js.map