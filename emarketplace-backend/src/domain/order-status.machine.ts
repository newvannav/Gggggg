import { OrderStatus } from '../generated/prisma';

/**
 * Order status machine — single source of truth for allowed transitions.
 * Enforced in the delivery/tracking service before any status write.
 */
const TRANSITIONS: Readonly<Record<OrderStatus, ReadonlySet<OrderStatus>>> = Object.freeze({
  [OrderStatus.PENDING]: new Set([
    OrderStatus.ACCEPTED_BY_SHOP,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.ACCEPTED_BY_SHOP]: new Set([
    OrderStatus.PREPARING,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.PREPARING]: new Set([
    OrderStatus.AWAITING_PICKUP,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.AWAITING_PICKUP]: new Set([
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.OUT_FOR_DELIVERY]: new Set([
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.DELIVERED]: new Set<OrderStatus>([]),
  [OrderStatus.CANCELLED]: new Set<OrderStatus>([]),
});

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  // noUncheckedIndexedAccess: Record lookups are `Set | undefined` at compile time.
  return TRANSITIONS[from]?.has(to) ?? false;
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal order status transition: ${from} -> ${to}`);
  }
}

export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
]);

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
