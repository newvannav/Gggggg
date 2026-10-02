import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ShopMapComponent } from '../../../shared/components/google-map/shop-map.component';
import { GeolocationService } from '../../../core/geolocation/geolocation.service';
import { ShopApiService } from './shop-api.service';
import { NearbyShopMapPoint } from './shop-api.service';
import { ShopDto } from '../../../shared/models/domain.models';

@Component({
  selector: 'app-discovery-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShopMapComponent, FormsModule],
  template: `
    <div class="discovery">
      <header class="discovery__bar">
        <label class="radius">
          Search radius
          <select [(ngModel)]="radiusKm" (ngModelChange)="refresh()">
            @for (option of radiusOptions; track option) {
              <option [ngValue]="option">{{ option }} km</option>
            }
          </select>
        </label>
        @if (geo.status() === 'denied') {
          <span class="pill pill--warn">Location blocked — enable GPS in browser settings</span>
        } @else if (loading()) {
          <span class="pill">Locating shops near you…</span>
        } @else {
          <span class="pill pill--ok">{{ shops().length }} shops within {{ radiusKm }} km</span>
        }
      </header>

      <section class="discovery__map">
        <app-shop-map
          [points]="mapPoints()"
          (shopBannerClicked)="onBannerClick($event)"
        />
      </section>

      <section class="discovery__list" aria-label="Nearby shops">
        @for (shopCtx of shops(); track shopCtx.id) {
          <article class="shop-card" (click)="openShop(shopCtx)">
            @if (shopCtx.logoUrl) {
              <img [src]="shopCtx.logoUrl" [alt]="shopCtx.name" loading="lazy" />
            }
            <div class="shop-card__body">
              <h3>{{ shopCtx.name }}</h3>
              <p>
                {{ shopCtx.distanceKm?.toFixed(1) ?? '?' }} km ·
                ~${ {{ shopCtx.estimatedDeliveryFee?.toFixed(2) ?? '--' }} } delivery ·
                {{ shopCtx.isOpenNow ? 'Open now' : 'Closed' }}
              </p>
            </div>
            <span class="shop-card__rating">★ {{ shopCtx.ratingAverage ?? 'new' }}</span>
          </article>
        } @empty {
          @if (!loading()) {
            <p class="empty">No shops found in this radius. Widen your search.</p>
          }
        }
      </section>
    </div>
  `,
  styles: `
    .discovery { display: grid; grid-template-rows: auto minmax(320px, 45vh) 1fr; height: 100%; }
    .discovery__bar { display: flex; align-items: center; gap: 16px; padding: 12px 16px; }
    .radius select { margin-left: 8px; }
    .pill { font-size: 13px; padding: 4px 10px; border-radius: 999px; background: #eef1f5; }
    .pill--ok { background: #dcf7ea; color: #0b6b3a; }
    .pill--warn { background: #fdf0d5; color: #8a5b00; }
    .discovery__map { border-block: 1px solid #e3e7ec; }
    .discovery__list { overflow-y: auto; padding: 8px 16px; display: flex; flex-direction: column; gap: 8px; }
    .shop-card { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #e3e7ec; border-radius: 12px; cursor: pointer; }
    .shop-card:hover { border-color: #29d38a; }
    .shop-card img { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; }
    .shop-card__body { flex: 1; }
    .shop-card__body h3 { margin: 0; font-size: 15px; }
    .shop-card__body p { margin: 2px 0 0; font-size: 13px; color: #5b6470; }
    .shop-card__rating { font-weight: 600; }
    .empty { color: #5b6470; text-align: center; padding: 24px; }
  `,
})
export class DiscoveryPageComponent implements OnInit {
  private readonly geo = inject(GeolocationService);
  private readonly api = inject(ShopApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly radiusOptions = [1, 3, 5, 10, 20] as const;
  protected radiusKm: number = 5;
  protected readonly loading = signal(false);
  protected readonly shops = signal<readonly ShopDto[]>([]);

  protected readonly mapPoints = computed(() => this.api.toMapPoints(this.shops()));

  ngOnInit(): void {
    // First fix → load once; subsequent drifts > ~250 m re-run the nearby query
    // so the list tracks the customer walking/driving.
    let lastOrigin: { lat: number; lng: number } | null = null;
    this.geo.watch()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((reading) => {
        const moved =
          lastOrigin === null ||
          Math.abs(reading.position.lat - lastOrigin.lat) > 0.0025 ||
          Math.abs(reading.position.lng - lastOrigin.lng) > 0.0025;
        if (moved) {
          lastOrigin = reading.position;
          this.loadShops(reading.position);
        }
      });
  }

  protected refresh(): void {
    const fix = this.geo.lastFix();
    if (fix) this.loadShops(fix.position);
  }

  protected onBannerClick(point: NearbyShopMapPoint): void {
    void this.router.navigate(['/customer/shops', point.shop.id]);
  }

  protected openShop(shop: ShopDto): void {
    void this.router.navigate(['/customer/shops', shop.id]);
  }

  private loadShops(origin: { lat: number; lng: number }): void {
    this.loading.set(true);
    this.api
      .nearbyShops(origin, this.radiusKm)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.shops.set(res.shops);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
