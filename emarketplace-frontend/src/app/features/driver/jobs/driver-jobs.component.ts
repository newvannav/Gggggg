import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { ShopMapComponent } from '../../../shared/components/google-map/shop-map.component';
import { DriverDispatchService } from '../delivery/driver-dispatch.service';

interface DriverJobDto {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly shopName: string;
  readonly shopLat: number;
  readonly shopLng: number;
  readonly dropoffLat: number;
  readonly dropoffLng: number;
  readonly dropoffAddress: string;
  readonly payoutAmount: number;
  readonly distanceKm: number;
}

@Component({
  selector: 'app-driver-jobs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShopMapComponent],
  template: `
    <div class="jobs">
      <header class="jobs__bar">
        <strong>{{ dispatch.jobState() }}</strong>
        @if (dispatch.activeOrderId(); as id) {
          <button type="button" class="btn btn--stop" (click)="finish()">Complete delivery #{{ id }}</button>
        }
        <span class="heartbeat" [class.ok]="dispatch.lastPushOk() === true" [class.bad]="dispatch.lastPushOk() === false">
          {{ dispatch.lastPushOk() === null ? 'GPS idle' : dispatch.lastPushOk() ? '✓ GPS pushed' : '✕ push failed' }}
        </span>
      </header>

      <section class="jobs__map">
        <google-map [points]="mapPoints()" />
      </section>

      <section class="jobs__board">
        @for (job of jobs(); track job.orderId) {
          <article class="job-card">
            <div>
              <strong>#{{ job.orderNumber }} · {{ job.shopName }}</strong>
              <p>To: {{ job.dropoffAddress }} ({{ job.distanceKm.toFixed(1) }} km)</p>
              <p class="pay">Driver payout: ${{ job.payoutAmount.toFixed(2) }}</p>
            </div>
            <button type="button" class="btn btn--accept" (click)="accept(job)">Accept &amp; start tracking</button>
          </article>
        } @empty {
          <p>No open jobs nearby. Pull to refresh.</p>
        }
      </section>
    </div>
  `,
  styles: `
    .jobs { display: grid; grid-template-rows: auto minmax(240px, 40vh) 1fr; height: 100%; }
    .jobs__bar { display: flex; align-items: center; gap: 14px; padding: 10px 16px; background: #101418; color: #fff; }
    .heartbeat { margin-left: auto; font-size: 12px; opacity: .75; }
    .heartbeat.ok { color: #29d38a; opacity: 1; }
    .heartbeat.bad { color: #ff6b6b; opacity: 1; }
    .btn { border: 0; border-radius: 8px; padding: 8px 12px; font-weight: 600; cursor: pointer; }
    .btn--stop { background: #ff6b6b; color: #2b0c0c; }
    .btn--accept { background: #29d38a; color: #06231a; }
    .jobs__board { overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
    .job-card { display: flex; justify-content: space-between; align-items: center; gap: 12px; border: 1px solid #e3e7ec; border-radius: 12px; padding: 12px 14px; }
    .job-card p { margin: 2px 0; font-size: 13px; color: #5b6470; }
    .pay { color: #0b6b3a !important; font-weight: 600; }
  `,
})
export class DriverJobsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly dispatch = inject(DriverDispatchService);

  protected readonly jobs = signal<readonly DriverJobDto[]>([]);

  protected readonly mapPoints = signal<
    readonly { id: string; lat: number; lng: number; label: string; subtitle?: string }[]
  >([]);

  ngOnInit(): void {
    this.refreshBoard();
  }

  protected accept(job: DriverJobDto): void {
    // Backend flips status + assigns driver; on success we start the GPS heartbeat.
    this.http
      .post<{ ok: boolean }>(`/v1/driver/jobs/${job.orderId}/accept`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.dispatch.startTracking(job.orderId);
        this.refreshBoard();
      });
  }

  protected finish(): void {
    const orderId = this.dispatch.activeOrderId();
    if (!orderId) return;
    this.http
      .post<{ ok: boolean }>(`/v1/driver/orders/${orderId}/delivered`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.dispatch.stopTracking());
  }

  private refreshBoard(): void {
    this.http
      .get<readonly DriverJobDto[]>('/v1/driver/jobs/open')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rows) => {
        this.jobs.set(rows);
        this.mapPoints.set(
          rows.flatMap((j) => [
            { id: `pickup-${j.orderId}`, lat: j.shopLat, lng: j.shopLng, label: j.shopName, subtitle: 'Pickup' },
            { id: `dropoff-${j.orderId}`, lat: j.dropoffLat, lng: j.dropoffLng, label: j.dropoffAddress, subtitle: 'Dropoff' },
          ]),
        );
      });
  }
}
