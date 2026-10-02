/**
 * Frontend mirrors of the Prisma schema (emarketplace-backend/prisma/schema.prisma).
 * Enums are string-literal unions matching the @@map'd Postgres types exactly.
 */

export type UserRole = 'CUSTOMER' | 'VENDOR' | 'DRIVER' | 'ADMIN';
export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED_BY_SHOP'
  | 'PREPARING'
  | 'AWAITING_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';
export type PaymentStatus =
  | 'UNPAID'
  | 'AUTHORIZED'
  | 'PAID'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'FAILED'
  | 'CANCELLED';

/** Order.status values in which a driver is actively en route. */
export const ACTIVE_TRACKING_STATUSES: readonly OrderStatus[] = [
  'OUT_FOR_DELIVERY',
] as const;

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export interface ShopDto {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly logoUrl: string | null;
  readonly coverImageUrl: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly currencyCode: string;
  readonly minimumOrderAmount: number;
  readonly averagePreparationTimeMinutes: number | null;
  readonly ratingAverage: number | null;
  readonly ratingCount: number;
  readonly isActive: boolean;
  readonly isApproved: boolean;
  /** Enriched by GET /v1/shops/nearby — distance in km from the requester. */
  readonly distanceKm?: number;
  /** Enriched server-side: dynamic delivery fee for THIS user's coordinates. */
  readonly estimatedDeliveryFee?: number;
  readonly isOpenNow?: boolean;
}

export interface ProductVariantDto {
  readonly id: string; // BigInt → serialized as string over the wire
  readonly productId: number;
  readonly name: string;
  readonly sku: string;
  readonly priceOffset: number;
  readonly stockQuantity: number;
  readonly allowBackorder: boolean;
  readonly isActive: boolean;
}

export interface ProductDto {
  readonly id: number;
  readonly shopId: number;
  readonly categoryId: number | null;
  readonly name: string;
  readonly slug: string;
  readonly basePrice: number;
  readonly currencyCode: string;
  readonly imageUrl: string | null;
  readonly trackInventory: boolean;
  readonly lowStockThreshold: number;
  readonly isActive: boolean;
  readonly variants: ProductVariantDto[];
}

export interface CartLine {
  readonly lineId: string;
  readonly productId: number;
  readonly variantId: string | null;
  readonly shopId: number;
  readonly productNameSnapshot: string;
  readonly variantNameSnapshot: string | null;
  readonly imageUrl: string | null;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly maxQuantity: number;
}

export interface OrderTrackingSnapshot {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly currentDriverLat: number | null;
  readonly currentDriverLng: number | null;
  readonly driverEtaMinutes: number | null;
  readonly updatedAt: string;
}

export interface DeliveryAddressDto {
  readonly id: number;
  readonly label: string | null;
  readonly recipientName: string;
  readonly recipientPhone: string | null;
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly latitude: number;
  readonly longitude: number;
}
