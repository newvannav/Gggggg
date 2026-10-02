import { OrderStatus } from '../../generated/prisma';

/** Frame pushed over the `order-{orderId}` Socket.IO room to the customer client. */
export interface TrackingLocationEvent {
  readonly type: 'LOCATION_UPDATE';
  readonly orderId: string;
  readonly currentDriverLat: number;
  readonly currentDriverLng: number;
  readonly driverEtaMinutes: number | null;
  /** Server clock — clients use this + their own latency estimate to interpolate. */
  readonly updatedAt: string;
}

export interface TrackingStatusEvent {
  readonly type: 'STATUS_CHANGE';
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly previousStatus: OrderStatus | null;
  readonly occurredAt: string;
}

export type TrackingEvent = TrackingLocationEvent | TrackingStatusEvent;

/** Result of a successful driver heartbeat write. */
export interface DriverTrackingAck {
  readonly orderId: string;
  readonly acceptedAt: string;
  readonly broadcastRecipients: number;
}
