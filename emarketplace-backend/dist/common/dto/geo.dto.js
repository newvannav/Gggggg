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
exports.PaginationQueryDto = exports.GeoPointDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class GeoPointDto {
    latitude;
    longitude;
}
exports.GeoPointDto = GeoPointDto;
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 7 }, { message: 'latitude must be a number with <= 7 decimal places' }),
    (0, class_validator_1.Min)(-90, { message: 'latitude must be between -90 and 90' }),
    (0, class_validator_1.Max)(90, { message: 'latitude must be between -90 and 90' }),
    __metadata("design:type", Number)
], GeoPointDto.prototype, "latitude", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 7 }, { message: 'longitude must be a number with <= 7 decimal places' }),
    (0, class_validator_1.Min)(-180, { message: 'longitude must be between -180 and 180' }),
    (0, class_validator_1.Max)(180, { message: 'longitude must be between -180 and 180' }),
    __metadata("design:type", Number)
], GeoPointDto.prototype, "longitude", void 0);
class PaginationQueryDto {
    page = 1;
    limit = 20;
}
exports.PaginationQueryDto = PaginationQueryDto;
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Object)
], PaginationQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Object)
], PaginationQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=geo.dto.js.map