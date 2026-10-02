import { Injectable, Logger } from '@nestjs/common';
import { Server as SocketIoServer } from 'socket.io';
import {
  BusinessRuleViolationError,
  ForbiddenError,
  InvalidCoordinatesError,
  ResourceNotFoundError,
} from '../../common/errors/domain-errors';
import { AuthPrincipal } from '../../common/auth/auth-principal.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderStatus, UserRole } from '../../generated/prisma';
import { assertTransition, isTerminal } from '../../domain/order-status.machine';
import { DriverLocationUpdateDto } from './dto/driver-location-update.dto';
import {
  DriverTrackingAck,
  TrackingEvent,
  TrackingLocationEvent,
  TrackingStatusEvent,
} from './tracking.types';

/** Statuses in which an assigned driver may push live coordinates. */
const TRACKABLE_STATUSES: ReadonlySet<OrderStatus> = new Set([OrderStatus.OUT_FOR_DELIVERY]);

/** Statuses the assigned driver may transition an order into. */
const DRIVER_ALLOWED_TARGETS: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
]);

/**
 * REAL-TIME DELIVERY DISPATCH & LOCATION UPDATE.
 *
 * Responsibilities:
 *  - Authoritative writes of driver coordinates onto the Order row
 *    (single source of truth even when no websocket client is connected).
 *  - Instant fan-out to the per-order Socket.IO room so every connected
 *    customer device sees the identical frame.
 *  - Strict ownership: only the driver assigned to the order (or an admin)
 *    may move it, and only while it is in a deliverable state.
 */
@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private io: SocketIoServer | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Injected post-bootstrap by TrackingGateway to avoid a circular provider edge. */
  setSocketServer(io: SocketIoServer): void {
    this.io = io;
  }

  async updateDriverLocation(
    orderId: bigint,
    dto: DriverLocationUpdateDto,
    actor: AuthPrincipal,
  ): Promise<DriverTrackingAck> {
    if (actor.role !== UserRole.DRIVER && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Only assigned drivers can push location updates');
    }

    // Reject "null island" / frozen-GPS placeholder fixes at the domain layer.
    if (dto.currentDriverLat === 0 && dto.currentDriverLng === 0) {
      throw new InvalidCoordinatesError('Driver reported placeholder coordinates (0,0)');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, driverId: true, status: true, customerId: true },
    });

    if (!order) {
      throw new ResourceNotFoundError("Order", orderId.toString());
    }
    if (actor.role !== UserRole.ADMIN && order.driverId !== actor.userId) {
      throw new ForbiddenError('You are not the assigned driver for this order');
    }
    if (!TRACKABLE_STATUSES.has(order.status)) {
      throw new BusinessRuleViolationError(
        'ORDER_NOT_TRACKABLE',
        `Order in status ${order.status} does not accept live location updates`,
      );
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

    const event: TrackingLocationEvent = {
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

  async transitionStatus(
    orderId: bigint,
    to: OrderStatus,
    actor: AuthPrincipal,
    note?: string,
  ): Promise<TrackingStatusEvent> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, driverId: true, shopId: true, customerId: true, status: true },
    });
    if (!order) {
      throw new ResourceNotFoundError("Order", orderId.toString());
    }

    if (actor.role === UserRole.DRIVER) {
      if (order.driverId !== actor.userId) {
        throw new ForbiddenError('You are not the assigned driver for this order');
      }
      if (!DRIVER_ALLOWED_TARGETS.has(to)) {
        throw new ForbiddenError(`Drivers cannot transition orders to ${to}`);
      }
    } else if (actor.role === UserRole.VENDOR) {
      if (actor.shopId === undefined || order.shopId !== actor.shopId) {
        throw new ForbiddenError('This order does not belong to your shop');
      }
    } else if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Only vendors, drivers or admins can change order status');
    }

    const from = order.status;
    if (isTerminal(from)) {
      throw new BusinessRuleViolationError('ORDER_TERMINAL', `Order already in terminal status ${from}`);
    }
    assertTransition(from, to);

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

    const event: TrackingStatusEvent = {
      type: 'STATUS_CHANGE',
      orderId: orderId.toString(),
      status: to,
      previousStatus: from,
      occurredAt: occurredAt.toISOString(),
    };
    this.broadcast(orderId, event);
    return event;
  }

  /** Read model backing the customer tracking screen's REST bootstrap. */
  async getTrackingSnapshot(orderId: bigint, viewer: AuthPrincipal) {
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
      throw new ResourceNotFoundError("Order", orderId.toString());
    }
    const isParty =
      viewer.role === UserRole.ADMIN ||
      viewer.userId === order.customerId ||
      viewer.userId === order.driverId;
    if (!isParty) {
      throw new ForbiddenError('Not authorized to view this order tracking');
    }
    return order;
  }

  private statusTimestampPatch(status: OrderStatus, at: Date): Record<string, unknown> {
    switch (status) {
      case OrderStatus.ACCEPTED_BY_SHOP:
        return { status, acceptedAt: at };
      case OrderStatus.PREPARING:
        return { status, preparingAt: at };
      case OrderStatus.AWAITING_PICKUP:
        return { status, awaitingPickupAt: at };
      case OrderStatus.OUT_FOR_DELIVERY:
        return { status, outForDeliveryAt: at };
      case OrderStatus.DELIVERED:
        return { status, deliveredAt: at };
      case OrderStatus.CANCELLED:
        return { status, cancelledAt: at };
      default:
        return { status };
    }
  }

  private broadcast(orderId: bigint, event: TrackingEvent): number {
    if (!this.io) {
      this.logger.warn(`Socket.IO server not attached; skipped broadcast for order ${orderId}`);
      return 0;
    }
    this.io.to(`order-${orderId}`).emit('tracking', event);
    return this.io.sockets.adapter.rooms.get(`order-${orderId}`)?.size ?? 0;
  }
}
