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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopDiscoveryController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const jwt_auth_guard_1 = require("../../common/auth/jwt-auth.guard");
const delivery_quote_request_dto_1 = require("./dto/delivery-quote-request.dto");
const nearby_shops_query_dto_1 = require("./dto/nearby-shops-query.dto");
const shop_discovery_service_1 = require("./shop-discovery.service");
let ShopDiscoveryController = class ShopDiscoveryController {
    discovery;
    constructor(discovery) {
        this.discovery = discovery;
    }
    async nearby(query) {
        return this.discovery.findNearby(query);
    }
    async deliveryQuote(_user, body) {
        const quote = await this.discovery.quoteToShop({ latitude: body.userLocation.latitude, longitude: body.userLocation.longitude }, body.shopId);
        return {
            distanceKm: quote.distanceKm,
            deliveryFee: quote.fee.toString(),
            etaMinutes: quote.etaMinutes,
        };
    }
};
exports.ShopDiscoveryController = ShopDiscoveryController;
__decorate([
    (0, common_1.Get)('nearby'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [nearby_shops_query_dto_1.NearbyShopsQueryDto]),
    __metadata("design:returntype", Promise)
], ShopDiscoveryController.prototype, "nearby", null);
__decorate([
    (0, common_1.Post)('delivery-quote'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, delivery_quote_request_dto_1.DeliveryQuoteRequestDto]),
    __metadata("design:returntype", Promise)
], ShopDiscoveryController.prototype, "deliveryQuote", null);
exports.ShopDiscoveryController = ShopDiscoveryController = __decorate([
    (0, common_1.Controller)('shops'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [shop_discovery_service_1.ShopDiscoveryService])
], ShopDiscoveryController);
//# sourceMappingURL=shop-discovery.controller.js.map