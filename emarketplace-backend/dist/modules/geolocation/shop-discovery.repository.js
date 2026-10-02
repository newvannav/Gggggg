"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ShopDiscoveryRepository_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopDiscoveryRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_1 = require("../../generated/prisma");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const domain_errors_1 = require("../../common/errors/domain-errors");
let ShopDiscoveryRepository = ShopDiscoveryRepository_1 = class ShopDiscoveryRepository {
    prisma;
    logger = new common_1.Logger(ShopDiscoveryRepository_1.name);
    postgisAvailable;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findShopByIdOrThrow(shopId) {
        const found = await this.prisma.shop.findFirst({
            where: { id: shopId, isActive: true, isApproved: true, deletedAt: null },
            select: { id: true, latitude: true, longitude: true, timezone: true },
        });
        if (!found) {
            throw new domain_errors_1.ResourceNotFoundError('Shop', shopId);
        }
        return found;
    }
    async findShopsWithinRadius(userLocation, radiusKm, limit) {
        const usePostgis = await this.detectPostgis();
        return usePostgis
            ? this.findWithPostgis(userLocation, radiusKm, limit)
            : this.findWithHaversine(userLocation, radiusKm, limit);
    }
    async detectPostgis() {
        if (this.postgisAvailable !== undefined) {
            return this.postgisAvailable;
        }
        try {
            const result = await this.prisma.$queryRaw(prisma_1.Prisma.sql `SELECT COUNT(*)::bigint AS found FROM pg_extension WHERE extname = 'postgis'`);
            this.postgisAvailable = Number(result[0]?.found ?? 0) > 0;
        }
        catch (error) {
            this.logger.warn(`PostGIS detection failed, using Haversine SQL: ${String(error)}`);
            this.postgisAvailable = false;
        }
        return this.postgisAvailable;
    }
    findWithPostgis(userLocation, radiusKm, limit) {
        const meters = radiusKm * 1000;
        return this.prisma.$queryRaw `
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
    findWithHaversine(userLocation, radiusKm, limit) {
        const R = 6371.0088;
        const latDelta = radiusKm / R;
        const cosLat = Math.cos((userLocation.latitude * Math.PI) / 180);
        const lngDelta = cosLat === 0 ? 180 : radiusKm / (R * Math.abs(cosLat));
        return this.prisma.$queryRaw `
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
};
exports.ShopDiscoveryRepository = ShopDiscoveryRepository;
exports.ShopDiscoveryRepository = ShopDiscoveryRepository = ShopDiscoveryRepository_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ShopDiscoveryRepository);
//# sourceMappingURL=shop-discovery.repository.js.map