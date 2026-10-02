import { Component, DestroyRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs';
import { ShopMapComponent } from '../../../shared/components/google-map/shop-map.component';
import { DriverTrackingSocketService } from './driver-tracking-socket.service';
import { OrderStatus, OrderTrackingSnapshot } from '../../../shared/models/domain.models';

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [ShopMapComponent],
  template: `
    <div class="tracking">
      <header class="tracking__status">
        <h2>{{ statusLabel(snapshot()?.status) }}</h2>
        @if (snapshot()?.driverEtaMinutes != null) {
          <p class="eta">ETA ~{{ snapshot()!.driverEtaMinutes }} min</p>
        }
        <span class="conn" [class.conn--live]="connected()">
          {{ connected() ? '● live' : '○ reconnecting…' }}
        </span>
      </header>

      <main class="tracking__map">
        <app-shop-map #map [points]="[]" [destination]="destination()" />
      </main>

      @if (snapshot(); as snap) {
        <footer class="tracking__ticker">
          Last driver ping: {{ timeAgo(snap.updatedAt) }} ·
          {{ snap.currentDriverLat?.toFixed(5) ?? '—' }}, {{ snap.currentDriverLng?.toFixed(5) ?? '—' }}
        </footer>
      }
    </div>
  `,
  styles: `
    .tracking { display: grid; grid-template-rows: auto 1fr auto; height: 100%; }
    .tracking__status { padding: 14px 16px; display: flex; align-items: baseline; gap: 16px; }
    .tracking__status h2 { margin: 0; font-size: 18px; }
    .eta { margin: 0; color: #0b6b3a; font-weight: 600; }
    .conn { margin-left: auto; font-size: 12px; color: #8a94a1; }
    .conn--live { color: #29d38a; }
    .tracking__map { border-block: 1px solid #e3e7ec; }
    .tracking__ticker { padding: 10px 16px; font-size: 12px; color: #5b6470; }
  `,
})
export class OrderTrackingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly socket = inject(DriverTrackingSocketService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild("map") private readonly mapRef?: ShopMapComponent;

  protected readonly snapshot = signal<OrderTrackingSnapshot | null>(null);
  protected readonly connected = signal(false);
  protected readonly destination = signal<{ lat: number; lng: number } | null>(null);

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (!orderId) return;

    // REST bootstrap: current authoritative state before WS frames start flowing.
    this.http
      .get<OrderTrackingSnapshot>(`/v1/orders/${orderId}/tracking`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((snap) => {
        this.snapshot.set(snap);
        if (snap.currentDriverLat !== null && snap.currentDriverLng !== null) {
          queueMicrotask(() =>
            this.mapRef?.pushDriverUpdate(snap.currentDriverLat!, snap.currentDriverLng!),
          );
        }
      });

    // Live stream: only LOCATION_UPDATE / STATUS_CHANGE frames after SNAPSHOT.
    this.socket.connect(orderId);
    this.connected.set(true);

    this.socket
      .messages$(orderId)
      .pipe(
        filter((msg) => msg.type === 'LOCATION_UPDATE' || msg.type === 'STATUS_CHANGE' || msg.type === 'SNAPSHOT'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((msg) => {
        const snap = msg.payload;
        this.snapshot.set(snap);
        if (snap.currentDriverLat !== null && snap.currentDriverLng !== null) {
          this.mapRef?.pushDriverUpdate(snap.currentDriverLat, snap.currentDriverLng);
        }
      });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => void 0);
  }

  protected statusLabel(status: OrderStatus | undefined): string {
    switch (status) {
      case 'PENDING':
        return 'Waiting for the shop to accept';
      case 'ACCEPTED_BY_SHOP':
        return 'Order accepted by shop';
      case 'PREPARING':
        return 'Your order is being prepared';
      case 'AWAITING_PICKUP':
        return 'Ready for driver pickup';
      case 'OUT_FOR_DELIVERY':
        return 'Driver is on the way';
      case 'DELIVERED':
        return 'Delivered — enjoy!';
      case 'CANCELLED':
        return 'Order cancelled';
      default:
        return 'Loading order…';
    }
  }

  protected timeAgo(iso: string): string {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    return minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
  }
}
