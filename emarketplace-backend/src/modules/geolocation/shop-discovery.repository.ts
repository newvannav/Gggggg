import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeoPoint } from '../../domain/geo';
import { ResourceNotFoundError } from '../../common/errors/domain-errors';
import { NearbyShopRow } from './shop-discovery.types';

/**
 * Data-access layer for shop discovery.
 *
 * STRATEGY (chosen at runtime, feature-detected once per process):
 *  1. PostGIS path — uses ST_DWithin on a GiST-indexed geography expression and
 *     ST_DistanceSphere for km. This is the production-fast route once the
 *     `postgis` extension migration referenced in schema.prisma is applied.
 *  2. Haversine fallback — pure-SQL great-circle math over the plain Float
 *     latitude/longitude columns, with a cheap bounding-box prefilter so the
 *     trig only runs on rows that can possibly be in range.
 *
 * Both paths are parameterized ($queryRaw tagged templates -> bind params,
 * never string interpolation) and return identical row shapes.
 */
@Injectable()
export class ShopDiscoveryRepository {
  private readonly logger = new Logger(ShopDiscoveryRepository.name);
  private postgisAvailable: boolean | undefined;

  constructor(private readonly prisma: PrismaService) {}

  /** Visibility check shared by discovery detail + order placement. */
  async findShopByIdOrThrow(shopId: number): Promise<{ id: number; latitude: number; longitude: number; timezone: string }> {
    const found = await this.prisma.shop.findFirst({
      where: { id: shopId, isActive: true, isApproved: true, deletedAt: null },
      select: { id: true, latitude: true, longitude: true, timezone: true },
    });
    if (!found) {
      throw new ResourceNotFoundError('Shop', shopId);
    }
    return found;
  }

  async findShopsWithinRadius(userLocation: GeoPoint, radiusKm: number, limit: number): Promise<NearbyShopRow[]> {
    const usePostgis = await this.detectPostgis();
    return usePostgis
      ? this.findWithPostgis(userLocation, radiusKm, limit)
      : this.findWithHaversine(userLocation, radiusKm, limit);
  }

  /** Feature detection is cached; falls back to Haversine if extension absent. */
  private async detectPostgis(): Promise<boolean> {
    if (this.postgisAvailable !== undefined) {
      return this.postgisAvailable;
    }
    try {
      const result = await this.prisma.$queryRaw<{ found: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS found FROM pg_extension WHERE extname = 'postgis'`,
      );
      this.postgisAvailable = Number(result[0]?.found ?? 0) > 0;
    } catch (error) {
      this.logger.warn(`PostGIS detection failed, using Haversine SQL: ${String(error)}`);
      this.postgisAvailable = false;
    }
    return this.postgisAvailable;
  }

  /**
   * PostGIS path. The ORDER BY ... LIMIT form lets the planner use a
   * KNN-capable index scan when shops carry a GiST geography index; we keep
   * ST_DWithin as an explicit predicate so results are radius-correct even
   * without the index.
   */
  private findWithPostgis(userLocation: GeoPoint, radiusKm: number, limit: number): Promise<NearbyShopRow[]> {
    const meters = radiusKm * 1000;
    return this.prisma.$queryRaw<NearbyShopRow[]>`
      SELECT
        s.id,
        s.name,
        s.slug,
        s."logoUrl",
        s.latitude,
        s.longitude,
        s.timezone,
        s."currencyCode"            AS "currencyCode",
        s."ratingAverage"::text     AS "ratingAverage",
        s."ratingCount",
        s."averagePreparationTimeMinutes" AS "averagePreparationTimeMinutes",
        s."minimumOrderAmount"::text      AS "minimumOrderAmount",
        ST_DistanceSphere(
          ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326),
          ST_SetSRID(ST_MakePoint(${userLocation.longitude}, ${userLocation.latitude}), 4326)
        ) / 1000.0                                                          AS "distanceKm"
      FROM shops s
      WHERE s."isActive" = TRUE
        AND s."isApproved" = TRUE
        AND s."deletedAt" IS NULL
        AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint(${userLocation.longitude}, ${userLocation.latitude}), 4326)::geography,
              ${meters}
            )
      ORDER BY "distanceKm" ASC
      LIMIT ${limit}
    `;
  }

  /**
   * Haversine fallback with bounding-box prefilter.
   * Box math: latDelta = r/R ; lngDelta = r/(R*cos(lat)) — generous enough to
   * contain the full circle, tight enough to prune most of the table cheaply.
   */
  private findWithHaversine(userLocation: GeoPoint, radiusKm: number, limit: number): Promise<NearbyShopRow[]> {
    const R = 6371.0088;
    const latDelta = radiusKm / R;
    const cosLat = Math.cos((userLocation.latitude * Math.PI) / 180);
    const lngDelta = cosLat === 0 ? 180 : radiusKm / (R * Math.abs(cosLat));

    return this.prisma.$queryRaw<NearbyShopRow[]>`
      WITH candidates AS (
        SELECT
          s.id,
          s.name,
          s.slug,
          s."logoUrl",
          s.latitude,
          s.longitude,
          s.timezone,
          s."currencyCode",
          s."ratingAverage",
          s."ratingCount",
          s."averagePreparationTimeMinutes",
          s."minimumOrderAmount",
          ${R} * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(${userLocation.latitude})) * cos(radians(s.latitude))
                * cos(radians(s.longitude) - radians(${userLocation.longitude}))
              + sin(radians(${userLocation.latitude})) * sin(radians(s.latitude))
            ))
          ) AS "distanceKm"
        FROM shops s
        WHERE s."isActive" = TRUE
          AND s."isApproved" = TRUE
          AND s."deletedAt" IS NULL
          AND s.latitude BETWEEN ${userLocation.latitude - latDelta} AND ${userLocation.latitude + latDelta}
          AND s.longitude BETWEEN ${userLocation.longitude - lngDelta} AND ${userLocation.longitude + lngDelta}
      )
      SELECT
        id,
        name,
        slug,
        "logoUrl",
        latitude,
        longitude,
        timezone,
        "currencyCode",
        "ratingAverage"::text   AS "ratingAverage",
        "ratingCount",
        "averagePreparationTimeMinutes",
        "minimumOrderAmount"::text AS "minimumOrderAmount",
        "distanceKm"
      FROM candidates
      WHERE "distanceKm" <= ${radiusKm}
      ORDER BY "distanceKm" ASC
      LIMIT ${limit}
    `;
  }
}
