import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { LatLng, ProductDto, ShopDto } from '../../../shared/models/domain.models';

export interface NearbyShopsResponse {
  readonly shops: readonly ShopDto[];
  readonly radiusKm: number;
  readonly serverTimestamp: string;
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
      .get<NearbyShopsResponse>('/v1/shops/nearby', { params })
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));
  }

  public shopProducts(shopId: number): Observable<readonly ProductDto[]> {
    return this.http.get<readonly ProductDto[]>(`/v1/shops/${shopId}/products`);
  }

  /** Maps wire ShopDto → <google-map> marker points with banner subtitles. */
  public toMapPoints(shops: readonly ShopDto[]): readonly (ShopDto & { id: string; lat: number; lng: number; label: string; subtitle: string })[] {
    return shops.map((s) => ({
      ...s,
      id: `shop-${s.id}`,
      lat: s.latitude,
      lng: s.longitude,
      label: s.name,
      subtitle:
        `${s.distanceKm?.toFixed(1) ?? '?'} km · $${s.estimatedDeliveryFee?.toFixed(2) ?? '—'} delivery` +
        (s.isOpenNow === false ? ' · Closed now' : ''),
    }));
  }
}
