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
var ShopDiscoveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopDiscoveryService = void 0;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const pricing_service_1 = require("../../domain/pricing.service");
const shop_hours_service_1 = require("../../domain/shop-hours/shop-hours.service");
const money_1 = require("../../domain/money");
const shop_discovery_repository_1 = require("./shop-discovery.repository");
const shop_discovery_types_1 = require("./shop-discovery.types");
const DEFAULT_LIMIT = 20;
let ShopDiscoveryService = ShopDiscoveryService_1 = class ShopDiscoveryService {
    repository;
    pricing;
    hours;
    logger = new common_1.Logger(ShopDiscoveryService_1.name);
    constructor(repository, pricing, hours) {
        this.repository = repository;
        this.pricing = pricing;
        this.hours = hours;
    }
    async findNearby(query) {
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
            const openness = shopHours.length > 0
                ? this.hours.isOpenNow(row.timezone, shopHours)
                : { isOpen: true };
            const quote = this.pricing.quoteDelivery(userPoint, { latitude: row.latitude, longitude: row.longitude });
            return (0, class_transformer_1.plainToInstance)(shop_discovery_types_1.NearbyShopResponseDto, {
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
                minimumOrderAmount: money_1.Money.from(row.minimumOrderAmount).toString(),
                distanceKm: quote.distanceKm,
                isOpenNow: openness.isOpen,
                deliveryFee: quote.fee.toString(),
                estimatedDeliveryMinutes: this.pricing.estimateEtaMinutes(quote.distanceKm, row.averagePreparationTimeMinutes),
            });
        });
    }
    getDiscoverableShopOrThrow(shopId) {
        return this.repository.findShopByIdOrThrow(shopId);
    }
    quoteFor(from, to) {
        return this.pricing.quoteDelivery(from, to);
    }
    async quoteToShop(from, shopId) {
        const shop = await this.repository.findShopByIdOrThrow(shopId);
        return this.pricing.quoteDelivery(from, { latitude: shop.latitude, longitude: shop.longitude });
    }
};
exports.ShopDiscoveryService = ShopDiscoveryService;
exports.ShopDiscoveryService = ShopDiscoveryService = ShopDiscoveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shop_discovery_repository_1.ShopDiscoveryRepository,
        pricing_service_1.PricingService,
        shop_hours_service_1.ShopHoursService])
], ShopDiscoveryService);
//# sourceMappingURL=shop-discovery.service.js.map