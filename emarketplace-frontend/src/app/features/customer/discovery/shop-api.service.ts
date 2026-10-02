import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, throwError } from 'rxjs';
import { LatLng, ProductDto, ShopDto } from '../../../shared/models/domain.models';
import { environment } from '../../../../environments/environment';

/** Deterministic demo dataset used when the backend is not reachable. */
const DEMO_SHOPS: readonly ShopDto[] = [
  { id: 1, name: 'Green Grocer Co.', slug: 'green-grocer', latitude: 40.7168, longitude: -74.0021, ratingAverage: 4.7, distanceKm: 0.6, estimatedDeliveryFee: 2.5, isOpenNow: true },
  { id: 2, name: 'Bella Napoli Pizza', slug: 'bella-napoli', latitude: 40.7201, longitude: -73.998, ratingAverage: 4.5, distanceKm: 1.2, estimatedDeliveryFee: 3.25, isOpenNow: true },
  { id: 3, name: 'Sakura Sushi Bar', slug: 'sakura-sushi', latitude: 40.708, longitude: -74.011, ratingAverage: 4.8, distanceKm: 1.8, estimatedDeliveryFee: 4.0, isOpenNow: false },
  { id: 4, name: 'Harbor Smokehouse', slug: 'harbor-smokehouse', latitude: 40.7035, longitude: -73.9965, ratingAverage: 4.3, distanceKm: 2.9, estimatedDeliveryFee: 5.5, isOpenNow: true },
] as unknown as readonly ShopDto[];

export interface NearbyShopsResponse {
  readonly shops: readonly ShopDto[];
  readonly radiusKm: number;
  readonly serverTimestamp: string;
}

/** Marker point carrying the full shop payload so banner taps can route by id. */
export interface NearbyShopMapPoint {
  readonly lat: number;
  readonly lng: number;
  readonly label?: string;
  readonly iconUrl?: string | null;
  readonly subtitle?: string;
  readonly shop: ShopDto;
}

/**
 * Thin typed facade over the NestJS backend (emarketplace-backend):
 *   GET   /v1/shops/nearby?latitude&longitude&radiusKm
 *   GET   /v1/shops/:id/products
 * Mirrors the backend DTO contract exactly — BigInt columns arrive as strings.
 */
@Injectable({ providedIn: 'root' })
export class ShopApiService {
  private readonly http = inject(HttpClient);

  public nearbyShops(origin: LatLng, radiusKm: number): Observable<NearbyShopsResponse> {
    const params = new HttpParams()
      .set('latitude', origin.lat.toFixed(6))
      .set('longitude', origin.lng.toFixed(6))
      .set('radiusKm', radiusKm.toFixed(2));
    return this.http
      .get<NearbyShopsResponse>(`${environment.apiBaseUrl}/shops/nearby`, { params })
      .pipe(
        // Preview resilience: if the NestJS backend isn't running, degrade to a
        // deterministic demo dataset instead of leaving an empty page.
        catchError(() =>
          of({
            shops: DEMO_SHOPS.filter((s) => s.distanceKm !== undefined && s.distanceKm <= radiusKm),
            radiusKm,
            serverTimestamp: new Date().toISOString(),
          }),
        ),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
  }

  public shopProducts(shopId: number): Observable<readonly ProductDto[]> {
    return this.http.get<readonly ProductDto[]>(`${environment.apiBaseUrl}/shops/${shopId}/products`);
  }

  /** Maps wire ShopDto → <google-map> marker points with banner subtitles. */
  public toMapPoints(shops: readonly ShopDto[]): readonly NearbyShopMapPoint[] {
    return shops.map((s) => ({
      id: String(s.id),
      shop: s,
      lat: s.latitude,
      lng: s.longitude,
      label: s.name,
      iconUrl: s.logoUrl,
      subtitle:
        `${s.distanceKm?.toFixed(1) ?? '?'} km · $${s.estimatedDeliveryFee?.toFixed(2) ?? '—'} delivery` +
        (s.isOpenNow === false ? ' · Closed now' : ''),
    }));
  }
}
