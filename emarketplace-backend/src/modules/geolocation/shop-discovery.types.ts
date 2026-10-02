import { Money } from '../../domain/money';

/** Raw row shape returned by the PostGIS/Haversine $queryRaw in ShopDiscoveryRepository. */
export interface NearbyShopRow {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly logoUrl: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly currencyCode: string;
  readonly ratingAverage: { toString(): string } | null;
  readonly ratingCount: number;
  readonly averagePreparationTimeMinutes: number | null;
  readonly minimumOrderAmount: { toString(): string };
  /** Kilometres computed DB-side (ST_DistanceSphere or Haversine SQL). */
  readonly distanceKm: number;
  /** Operating hours for "today" in the shop's timezone, if configured. */
  readonly opensAtToday: Date | null;
  readonly closesAtToday: Date | null;
  readonly closedToday: boolean;
}

/** Delivery-fee quote attached to every nearby shop based on user↔shop distance. */
export interface DeliveryQuote {
  readonly fee: Money;
  readonly distanceKm: number;
  readonly etaMinutes: number;
}

/** API response item — presentation model, decoupled from the raw row. */
export class NearbyShopResponseDto {
  id!: number;
  name!: string;
  slug!: string;
  logoUrl!: string | null;
  latitude!: number;
  longitude!: number;
  timezone!: string;
  currencyCode!: string;
  ratingAverage!: string | null;
  ratingCount!: number;
  averagePreparationTimeMinutes!: number | null;
  minimumOrderAmount!: string;
  distanceKm!: number;
  isOpenNow!: boolean;
  deliveryFee!: string;
  estimatedDeliveryMinutes!: number;
}
