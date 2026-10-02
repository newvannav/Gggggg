import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, Output, SimpleChanges, EventEmitter, inject, signal } from '@angular/core';
import { GoogleMap, MapAdvancedMarker, MapInfoWindow, MapInfoWindowContent } from '@angular/google-maps';
import { GOOGLE_MAPS_CONFIG, MapMarkerPoint, MarkerCluster } from '../../../core/config/google-maps.config';

/**
 * Reusable standalone map built on @angular/google-maps.
 *
 * Responsibilities:
 *  - project an array of shop/POI objects as advanced markers with custom icons
 *  - grid-based bounding-box clustering when zoomed out (marker count is O(clusters))
 *  - emit `shopBannerClicked` when a customer taps a marker's info banner
 *  - expose a smooth `pushDriverUpdate()` API used by the live-tracking view
 */
@Component({
  selector: 'app-shop-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GoogleMap, MapAdvancedMarker, MapInfoWindow, MapInfoWindowContent],
  template: `
    <google-map
      #nativeMap
      height="100%"
      width="100%"
      [center]="center()"
      [zoom]="zoom()"
      [options]="mapOptions"
      (zoomChanged)="onZoomChanged($event)"
      (mapClick)="openBannerId.set(null)"
    >
      @for (cluster of clusters(); track cluster.key) {
        @if (cluster.points.length === 1) {
          <map-advanced-marker
            [position]="toLatLng(cluster.points[0])"
            [title]="cluster.points[0].label ?? ''"
            [options]="markerOptions(cluster.points[0])"
            (mapClick)="selectBanner(cluster.points[0].id)"
          />
        } @else {
          <map-advanced-marker
            [position]="cluster.center"
            [title]="cluster.count + ' shops near you'"
            [options]="clusterOptions(cluster)"
            (mapClick)="expandCluster(cluster)"
          />
        }
      }

      @if (selectedPoint(); as point) {
        <map-info-window [options]="{ maxWidth: 320 }">
          <map-info-window-content>
            <div class="banner">
              @if (point.iconUrl) {
                <img class="banner__logo" [src]="point.iconUrl" [alt]="point.label ?? 'shop'" loading="lazy" />
              }
              <div class="banner__meta">
                <strong>{{ point.label }}</strong>
                <span>{{ point.subtitle }}</span>
              </div>
              <button type="button" class="banner__cta" (click)="shopBannerClicked.emit(point)">Open shop →</button>
            </div>
          </map-info-window-content>
        </map-info-window>
      }

      @if (deliveryDestination(); as dest) {
        <map-advanced-marker [position]="dest" title="Delivery address" />
      }

      @if (driverPosition(); as driver) {
        <map-advanced-marker [position]="driver" [title]="'Your driver'" [options]="driverMarkerOptions" />
      }
    </google-map>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .banner { display: flex; align-items: center; gap: 10px; padding: 4px; }
    .banner__logo { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; }
    .banner__meta { display: flex; flex-direction: column; min-width: 120px; }
    .banner__meta span { font-size: 12px; color: #5b6470; }
    .banner__cta { margin-left: auto; border: 0; background: #101418; color: #fff; border-radius: 8px; padding: 8px 12px; font-weight: 600; cursor: pointer; }
  `,
})
export class ShopMapComponent implements OnChanges, OnDestroy {
  private readonly mapsConfig = inject(GOOGLE_MAPS_CONFIG);

  /** Points of interest (shops). Extended in-line with subtitle for banners. */
  @Input() points: ReadonlyArray<MapMarkerPoint & { subtitle?: string }> = [];
  /** Optional delivery destination pin (customer tracking view). */
  @Input() set deliveryDestination(value: google.maps.LatLngLiteral | null) {
    this._deliveryDestination.set(value);
    if (value) this.fitBounds([value, ...this.points.map((pt) => ({ lat: pt.lat, lng: pt.lng }))]);
  }
  private readonly _deliveryDestination = signal<google.maps.LatLngLiteral | null>(null);
  protected readonly deliveryDestination = this._deliveryDestination.asReadonly();

  @Output() readonly shopBannerClicked = new EventEmitter<MapMarkerPoint>();

  protected readonly center = signal<google.maps.LatLngLiteral>({ lat: 40.7128, lng: -74.006 });
  protected readonly zoom = signal(13);
  protected readonly openBannerId = signal<string | null>(null);
  protected readonly driverPosition = signal<google.maps.LatLngLiteral | null>(null);

  private lastDriverRaw: google.maps.LatLngLiteral | null = null;
  private smoothingTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly mapOptions: google.maps.MapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
    gestureHandling: 'greedy',
    mapId: this.mapsConfig.mapsId,
  };

  protected readonly driverMarkerOptions: google.maps.marker.AdvancedMarkerElementOptions = {
    gmpDraggable: false,
    title: 'Your driver',
  };

  /** Grid clustering keyed off current zoom — recomputed on input/zoom changes. */
  protected readonly clusters = signal<
    readonly (MarkerCluster<MapMarkerPoint & { subtitle?: string }> & { key: string })[]
  >([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['points'] && this.points.length > 0) {
      const first = this.points[0];
      this.center.set({ lat: first.lat, lng: first.lng });
      this.recluster();
    }
  }

  ngOnDestroy(): void {
    if (this.smoothingTimer !== null) clearInterval(this.smoothingTimer);
  }

  /** Public API used by the tracking component: feed raw WS coordinates. */
  public pushDriverUpdate(lat: number, lng: number): void {
    this.lastDriverRaw = { lat, lng };
    if (this.driverPosition() === null) {
      this.driverPosition.set(this.lastDriverRaw);
      return;
    }
    if (this.smoothingTimer === null) {
      // Animate toward the newest fix at ~20fps instead of snapping per packet.
      this.smoothingTimer = setInterval(() => this.stepTowardTarget(), 50);
    }
  }

  protected toLatLng(p: MapMarkerPoint): google.maps.LatLngLiteral {
    return { lat: p.lat, lng: p.lng };
  }

  protected selectedPoint(): (MapMarkerPoint & { subtitle?: string }) | null {
    const id = this.openBannerId();
    return id === null ? null : this.points.find((p) => p.id === id) ?? null;
  }

  protected selectBanner(id: string): void {
    this.openBannerId.set(id);
  }

  protected onZoomChanged(zoom: number | null): void {
    if (zoom !== null) {
      this.zoom.set(zoom);
      this.recluster();
    }
  }

  protected expandCluster(cluster: MarkerCluster<MapMarkerPoint & { subtitle?: string }>): void {
    this.center.set(cluster.center);
    this.zoom.update((z) => Math.min(z + 2, 18));
    this.recluster();
  }

  protected markerOptions(p: MapMarkerPoint): google.maps.marker.AdvancedMarkerElementOptions {
    return { title: p.label ?? 'Shop' };
  }

  protected clusterOptions(cluster: MarkerCluster<MapMarkerPoint>): google.maps.marker.AdvancedMarkerElementOptions {
    return { title: `${cluster.count} shops` };
  }

  /** Fit the viewport around a set of literals (centroid + span heuristic keeps SSR-safe). */
  private fitBounds(literals: readonly google.maps.LatLngLiteral[]): void {
    const pts = literals.filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng));
    if (pts.length === 0) return;
    const lat = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
    const lng = pts.reduce((a, p) => a + p.lng, 0) / pts.length;
    this.center.set({ lat, lng });
    const maxDelta = Math.max(...pts.map((p) => Math.abs(p.lat - lat) + Math.abs(p.lng - lng)));
    this.zoom.set(maxDelta > 0.5 ? 11 : maxDelta > 0.1 ? 13 : maxDelta > 0.02 ? 14 : 15);
  }

  /**
   * Bounding-box grid clustering: cell size shrinks with zoom so that at city
   * level nearby shops collapse into numbered bubbles, and at street level every
   * shop renders individually with its logo icon.
   */
  private recluster(): void {
    const zoom = this.zoom();
    const degPerCell = 360 / Math.pow(2, zoom) / 3; // ≈ one third of a tile
    const buckets = new Map<string, (MapMarkerPoint & { subtitle?: string })[]>();
    for (const p of this.points) {
      const key = `${Math.round(p.lat / degPerCell)}:${Math.round(p.lng / degPerCell)}`;
      const list = buckets.get(key);
      if (list) list.push(p);
      else buckets.set(key, [p]);
    }
    const clusters = [...buckets.entries()].map(([key, pts]) => ({
      key,
      count: pts.length,
      center: {
        lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length,
        lng: pts.reduce((a, p) => a + p.lng, 0) / pts.length,
      },
      points: pts,
    }));
    this.clusters.set(clusters);
  }

  /** Linear interpolation step toward the latest raw driver fix. */
  private stepTowardTarget(): void {
    const target = this.lastDriverRaw;
    const current = this.driverPosition();
    if (!target || !current) return;
    const factor = 0.35;
    const next = {
      lat: current.lat + (target.lat - current.lat) * factor,
      lng: current.lng + (target.lng - current.lng) * factor,
    };
    if (Math.abs(target.lat - next.lat) < 1e-6 && Math.abs(target.lng - next.lng) < 1e-6) {
      this.driverPosition.set(target);
      if (this.smoothingTimer !== null) {
        clearInterval(this.smoothingTimer);
        this.smoothingTimer = null;
      }
      return;
    }
    this.driverPosition.set(next);
  }
}
