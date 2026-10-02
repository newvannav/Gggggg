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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const decimal_js_1 = __importDefault(require("decimal.js"));
const geo_1 = require("./geo");
const money_1 = require("./money");
let PricingService = class PricingService {
    pricing;
    constructor(config) {
        const loaded = config.getOrThrow('pricing');
        this.pricing = loaded;
    }
    deliveryFeeForDistance(distanceKm) {
        if (!Number.isFinite(distanceKm) || distanceKm < 0) {
            throw new RangeError(`distanceKm must be a non-negative finite number, got ${String(distanceKm)}`);
        }
        const p = this.pricing;
        const billableExcess = new decimal_js_1.default(distanceKm).minus(p.freeDistanceKm).clamp(0, Infinity);
        const raw = new decimal_js_1.default(p.deliveryBaseFee).plus(billableExcess.times(p.perKmFee));
        const capped = decimal_js_1.default.min(raw, new decimal_js_1.default(p.maxDeliveryFee));
        return money_1.Money.from(capped.toString()).round();
    }
    quoteDelivery(from, to) {
        const distanceKm = (0, geo_1.haversineKm)(from, to);
        return {
            fee: this.deliveryFeeForDistance(distanceKm),
            distanceKm: roundTo2(distanceKm),
            etaMinutes: this.estimateEtaMinutes(distanceKm),
        };
    }
    estimateEtaMinutes(distanceKm, shopPrepMinutes) {
        const prep = shopPrepMinutes ?? this.pricing.minPrepMinutes;
        const travelMinutes = (distanceKm / this.pricing.avgSpeedKmh) * 60;
        return Math.max(5, Math.ceil(prep + travelMinutes));
    }
    platformServiceFee(subtotal, commissionRate, fixedCommission) {
        const pct = subtotal.times(new decimal_js_1.default(commissionRate)).round();
        return pct.plus(money_1.Money.from(fixedCommission).round());
    }
    lineTax(lineTotal, taxRate) {
        const rateStr = taxRate ?? String(this.pricing.defaultTaxRate);
        const amount = lineTotal.times(new decimal_js_1.default(rateStr)).round();
        return { rate: money_1.Money.from(rateStr), amount };
    }
    netVendorPayout(subtotal, platformServiceFee) {
        return subtotal.minus(platformServiceFee).round().max(money_1.Money.zero());
    }
};
exports.PricingService = PricingService;
exports.PricingService = PricingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PricingService);
function roundTo2(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=pricing.service.js.map