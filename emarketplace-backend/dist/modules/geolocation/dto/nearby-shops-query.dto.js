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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearbyShopsQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const geo_dto_1 = require("../../../common/dto/geo.dto");
class NearbyShopsQueryDto extends geo_dto_1.GeoPointDto {
    radiusKm;
    limit;
}
exports.NearbyShopsQueryDto = NearbyShopsQueryDto;
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 3 }, { message: 'radiusKm must be a number' }),
    (0, class_validator_1.Min)(0.1, { message: 'radiusKm must be at least 0.1' }),
    (0, class_validator_1.Max)(50, { message: 'radiusKm must be at most 50' }),
    __metadata("design:type", Number)
], NearbyShopsQueryDto.prototype, "radiusKm", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'limit must be a number' }),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], NearbyShopsQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=nearby-shops-query.dto.js.map