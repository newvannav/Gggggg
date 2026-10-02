import { Injectable, NgZone, inject, signal } from '@angular/core';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import { Observable, retry, shareReplay } from 'rxjs';
import { OrderTrackingSnapshot } from '../../../shared/models/domain.models';

/** Messages the NestJS `tracking` namespace pushes to customer sockets. */
export type TrackingServerMessage =
  | { readonly type: 'SNAPSHOT'; readonly payload: OrderTrackingSnapshot }
  | { readonly type: 'LOCATION_UPDATE'; readonly payload: OrderTrackingSnapshot }
  | { readonly type: 'STATUS_CHANGE'; readonly payload: OrderTrackingSnapshot };

export interface TrackingSocketState {
  readonly connected: boolean;
  readonly lastSnapshot: OrderTrackingSnapshot | null;
}

/**
 * RxJS WebSocket bridge to the backend dispatch gateway
 * (ws://…/ws/tracking?orderId=:id&token=…). One subject per order id;
 * reconnects with exponential backoff and replays the latest snapshot to late
 * subscribers so a re-rendered map never shows a stale driver pin.
 */
@Injectable({ providedIn: 'root' })
export class DriverTrackingSocketService {
  private readonly zone = inject(NgZone);
  private readonly subjects = new Map<string, WebSocketSubject<TrackingServerMessage>>();
  private readonly shared$ = new Map<string, Observable<TrackingServerMessage>>();
  private readonly states = new Map<string, TrackingSocketState>();
  public readonly stateSignal = signal<ReadonlyMap<string, TrackingSocketState>>(new Map());

  /** Connect (or reuse) the socket for an order and stream tracking frames. */
  public connect(orderId: string): void {
    if (this.subjects.has(orderId)) return;

    const token = this.readAuthToken();
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${location.host}/ws/tracking?orderId=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token ?? '')}`;

    const subject = webSocket<TrackingServerMessage>({
      url,
      deserializer: (e) => JSON.parse(e.data as string) as TrackingServerMessage,
      serializer: (msg) => JSON.stringify(msg),
    });

    // Keep WS frame handling out of the Angular zone; components opt back in
    // via signals + OnPush, avoiding change-detection storms on every packet.
    this.zone.runOutsideAngular(() => {
      const stream$: Observable<TrackingServerMessage> = subject.pipe(
        // Reconnect: 1s → 2s → 4s … capped at 30s, forever while page is open.
        retry({ delay: (_err, attempt) => new Promise((resolve) => setTimeout(resolve, Math.min(1_000 * 2 ** attempt, 30_000))) }),
        // Replay the most recent frame to late subscribers (map re-renders).
        shareReplay({ bufferSize: 1, refCount: true }),
      );
      this.shared$.set(orderId, stream$);
      stream$.subscribe({
        next: (msg) => this.applyMessage(orderId, msg),
        error: () => this.setState(orderId, false),
      });
    });

    this.subjects.set(orderId, subject);
    this.setState(orderId, true);
  }

  /** Observable of raw frames for a given order (already zone-outside). */
  public messages$(orderId: string) {
    return this.shared$.get(orderId) ?? this.connectAndReturn(orderId);
  }

  public disconnect(orderId: string): void {
    const subject = this.subjects.get(orderId);
    if (!subject) return;
    subject.complete();
    this.subjects.delete(orderId);
    this.shared$.delete(orderId);
    this.states.delete(orderId);
    this.publishStates();
  }

  private connectAndReturn(orderId: string) {
    this.connect(orderId);
    return this.shared$.get(orderId)!;
  }

  private applyMessage(orderId: string, msg: TrackingServerMessage): void {
    const prev = this.states.get(orderId);
    const next: TrackingSocketState = {
      connected: true,
      lastSnapshot: msg.payload,
    };
    this.states.set(orderId, next);
    this.publishStates();
    void prev;
  }

  private setState(orderId: string, connected: boolean): void {
    const prev = this.states.get(orderId);
    this.states.set(orderId, { connected, lastSnapshot: prev?.lastSnapshot ?? null });
    this.publishStates();
  }

  private publishStates(): void {
    this.stateSignal.set(new Map(this.states));
  }

  private readAuthToken(): string | null {
    try {
      return localStorage.getItem('emarket.jwt');
    } catch {
      return null;
    }
  }
}

