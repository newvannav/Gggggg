import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Observable, Subject, filter, map, of, shareReplay, throwError, timer } from 'rxjs';
import { LatLng } from '../../shared/models/domain.models';

export type GeolocationStatus = 'unsupported' | 'prompt' | 'granted' | 'denied' | 'unavailable';

export interface GeoReading {
  readonly position: LatLng;
  readonly accuracyMeters: number;
  readonly headingDeg: number | null;
  readonly speedMps: number | null;
  readonly timestamp: number;
}

/**
 * Single owner of browser geolocation. Wraps navigator.geolocation in RxJS,
 * keeps the last-known fix in a signal for synchronous reads (e.g. guards,
 * query params) and exposes watch() as a multicast observable stream.
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly zone = inject(NgZone);

  public readonly status = signal<GeolocationStatus>('prompt');
  public readonly lastFix = signal<GeoReading | null>(null);
  public readonly error$ = new Subject<string>();

  /**
   * Dev/demo fallback fix (NYC) so the preview renders shops without a real GPS
   * device or permission prompt. Only used when geolocation is unsupported or
   * unavailable — never overrides a genuine fix.
   */
  private readonly demoFix: GeoReading = {
    position: { lat: 40.7128, lng: -74.006 },
    accuracyMeters: 500,
    headingDeg: null,
    speedMps: null,
    timestamp: Date.now(),
  };

  /** One-shot high-accuracy read — used before first render of discovery map. */
  getCurrentPosition(): Observable<GeoReading> {
    if (!('geolocation' in navigator)) {
      this.status.set('unsupported');
      this.apply(this.demoFix);
      return of(this.demoFix);
    }
    return new Observable<GeoReading>((subscriber) => {
      this.zone.runOutsideAngular(() => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const reading = this.toReading(pos);
            this.apply(reading);
            subscriber.next(reading);
            subscriber.complete();
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              this.status.set('denied');
              this.error$.next('Location permission denied. Enable it in browser settings to see nearby shops.');
              // Denial must not blank the page: fall back to the demo fix so the
              // discovery flow (and preview) still renders with mock coordinates.
              this.apply(this.demoFix);
              subscriber.next(this.demoFix);
              subscriber.complete();
              return;
            } else if (err.code === err.POSITION_UNAVAILABLE) {
              this.status.set('unavailable');
              this.error$.next('No location source available (GPS offline / wifi positioning failed).');
            } else {
              this.error$.next('Timed out acquiring GPS fix — retrying is safe.');
            }
            subscriber.error(new Error(err.code === err.TIMEOUT ? 'GEO_TIMEOUT' : 'GEO_ERROR'));
          },
          { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
        );
      });
    });
  }

  /**
   * Continuous watch with backoff on transient failures. Multicast via
   * shareReplay so multiple consumers (map, nearby-shops query, driver
   * telemetry loop) share one underlying OS-level watch.
   */
  watch(): Observable<GeoReading> {
    if (!('geolocation' in navigator)) {
      this.status.set('unsupported');
      this.apply(this.demoFix);
      return of(this.demoFix);
    }
    return new Observable<GeoReading>((subscriber) => {
      let watchId: number | null = null;
      // Seed subscribers with the last known (or demo) fix so consumers render
      // immediately even before the first hardware update arrives.
      const seed = this.lastFix();
      if (seed !== null) subscriber.next(seed);
      const start = (): void => {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const reading = this.toReading(pos);
            this.apply(reading);
            subscriber.next(reading);
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              this.status.set('denied');
              // Never terminate the stream on denial — fall back to the demo fix
              // so downstream queries (nearby shops, map) still function.
              this.apply(this.demoFix);
              subscriber.next(this.demoFix);
              return;
            }
            // POSITION_UNAVAILABLE / TIMEOUT: tear down and re-arm after 5s.
            this.status.set('unavailable');
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            const retrySub = timer(5_000).subscribe(() => start());
            subscriber.add(retrySub);
          },
          { enableHighAccuracy: true, timeout: 20_000, maximumAge: 2_000 },
        );
      };
      this.zone.runOutsideAngular(start);
      return () => {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      };
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  }

  /** Convenience pipe: emits only valid on-screen coordinates. */
  coordinates$(): Observable<LatLng> {
    return this.watch().pipe(
      map((r) => r.position),
      filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    );
  }

  private toReading(pos: GeolocationPosition): GeoReading {
    return {
      position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      accuracyMeters: pos.coords.accuracy,
      headingDeg: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
      speedMps: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
      timestamp: pos.timestamp,
    };
  }

  private apply(reading: GeoReading): void {
    this.status.set('granted');
    this.lastFix.set(reading);
  }
}
