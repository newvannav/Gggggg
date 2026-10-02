import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GeolocationService } from '../../../core/geolocation/geolocation.service';
import { ToastService } from '../../../shared/services/toast.service';

export type DriverJobState = 'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY';

interface PushResult {
  readonly accepted: boolean;
  readonly broadcastedTo: number;
}

/**
 * Driver portal heartbeat loop. While a job is ACTIVE it:
 *   1. samples the device GPS via GeolocationService.watch()
 *   2. throttles to one PATCH /v1/driver/orders/:id/tracking per 5 s
 *      (backend validates lat/lng bounds + DRIVER role and broadcasts over WS)
 *   3. surfaces delivery failures as toasts instead of killing the loop
 */
@Injectable({ providedIn: 'root' })
export class DriverDispatchService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly geo = inject(GeolocationService);
  private readonly toast = inject(ToastService);
  private readonly zone = inject(NgZone);

  public readonly jobState = signal<DriverJobState>('OFFLINE');
  public readonly activeOrderId = signal<string | null>(null);
  public readonly lastPushOk = signal<boolean | null>(null);

  private geoSub?: import('rxjs').Subscription;
  private pendingPosition: { lat: number; lng: number } | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  /** Called when the driver accepts a job from the dispatch board. */
  public startTracking(orderId: string): void {
    this.stopTracking();
    this.activeOrderId.set(orderId);
    this.jobState.set('ON_DELIVERY');

    // Buffer the newest fix outside Angular; push on a fixed cadence.
    this.geoSub = this.geo.watch().subscribe((reading) => {
      this.pendingPosition = reading.position;
    });

    this.flushTimer = this.zone.runOutsideAngular(() =>
      setInterval(() => this.flush(), 5_000),
    );
  }

  public stopTracking(): void {
    this.geoSub?.unsubscribe();
    this.geoSub = undefined;
    if (this.flushTimer !== null) clearInterval(this.flushTimer);
    this.flushTimer = null;
    this.pendingPosition = null;
    this.activeOrderId.set(null);
    this.jobState.set('OFFLINE');
  }

  ngOnDestroy(): void {
    this.stopTracking();
  }

  private flush(): void {
    const orderId = this.activeOrderId();
    const pos = this.pendingPosition;
    if (!orderId || !pos) return;

    this.http
      .patch<PushResult>(`/v1/driver/orders/${orderId}/tracking`, {
        currentDriverLat: Number(pos.lat.toFixed(6)),
        currentDriverLng: Number(pos.lng.toFixed(6)),
      })
      .subscribe({
        next: (res) => this.zone.run(() => this.lastPushOk.set(res.accepted)),
        error: (err) => {
          this.zone.run(() => {
            this.lastPushOk.set(false);
            if (err.status === 403) {
              this.toast.error('Session expired or not a driver account — tracking stopped.');
              this.stopTracking();
            } else if (err.status === 409) {
              this.toast.warning('Order left the deliverable state; tracking stopped.');
              this.stopTracking();
            } // network errors: keep looping, next tick retries
          });
        },
      });
  }
}
