import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PricingService } from '../../domain/pricing.service';
import { ShopHoursService } from '../../domain/shop-hours/shop-hours.service';
import { Money } from '../../domain/money';
import { ShopDiscoveryRepository } from './shop-discovery.repository';
import { NearbyShopsQueryDto } from './dto/nearby-shops-query.dto';
import { NearbyShopResponseDto } from './shop-discovery.types';

const DEFAULT_LIMIT = 20;

@Injectable()
export class ShopDiscoveryService {
  private readonly logger = new Logger(ShopDiscoveryService.name);

  constructor(
    private readonly repository: ShopDiscoveryRepository,
    private readonly pricing: PricingService,
    private readonly hours: ShopHoursService,
  ) {}

  /**
   * GET /shops/nearby — discovery + dynamic delivery quotes.
   *
   * Flow:
   *  1. Raw spatial SQL (PostGIS GiST or Haversine w/ bbox prefilter) returns
   *     in-radius shops sorted by proximity.
   *  2. Operating hours are batch-loaded and evaluated in each shop's own
   *     timezone to compute isOpenNow.
   *  3. Delivery fee + ETA are quoted per shop from user↔shop distance.
   */
  async findNearby(query: NearbyShopsQueryDto): Promise<NearbyShopResponseDto[]> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const userPoint = { latitude: query.latitude, longitude: query.longitude };

    const rows = await this.repository.findShopsWithinRadius(userPoint, query.radiusKm, limit);

    if (rows.length === 0) {
      this.logger.debug(`No shops within ${query.radiusKm}km of (${query.latitude}, ${query.longitude})`);
      return [];
    }

    const hoursByShop = await this.hours.hoursByShopIds(rows.map((r) => r.id));

    return rows.map((row) => {
      const shopHours = hoursByShop.get(row.id) ?? [];
      // Shops with no configured hours default to open (vendor hasn't set schedule yet).
      const openness = shopHours.length > 0
        ? this.hours.isOpenNow(row.timezone, shopHours)
        : { isOpen: true as const };

      const quote = this.pricing.quoteDelivery(userPoint, { latitude: row.latitude, longitude: row.longitude });

      return plainToInstance(NearbyShopResponseDto, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        logoUrl: row.logoUrl,
        latitude: row.latitude,
        longitude: row.longitude,
        timezone: row.timezone,
        currencyCode: row.currencyCode,
        ratingAverage: row.ratingAverage?.toString() ?? null,
        ratingCount: row.ratingCount,
        averagePreparationTimeMinutes: row.averagePreparationTimeMinutes,
        minimumOrderAmount: Money.from(row.minimumOrderAmount).toString(),
        distanceKm: quote.distanceKm,
        isOpenNow: openness.isOpen,
        deliveryFee: quote.fee.toString(),
        estimatedDeliveryMinutes: this.pricing.estimateEtaMinutes(quote.distanceKm, row.averagePreparationTimeMinutes),
      });
    });
  }

  getDiscoverableShopOrThrow(shopId: number): Promise<{ id: number; latitude: number; longitude: number; timezone: string }> {
    return this.repository.findShopByIdOrThrow(shopId);
  }

  /** Fee/ETA quote between arbitrary points (cart preview path). */
  quoteFor(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): { fee: Money; distanceKm: number; etaMinutes: number } {
    return this.pricing.quoteDelivery(from, to);
  }

  /** Fee/ETA quote from a point to a persisted shop. */
  async quoteToShop(
    from: { latitude: number; longitude: number },
    shopId: number,
  ): Promise<{ fee: Money; distanceKm: number; etaMinutes: number }> {
    const shop = await this.repository.findShopByIdOrThrow(shopId);
    return this.pricing.quoteDelivery(from, { latitude: shop.latitude, longitude: shop.longitude });
  }
}
