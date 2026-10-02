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
exports.OrderItemInputDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class OrderItemInputDto {
    productId;
    variantId;
    quantity;
    configuration;
    modifiers;
}
exports.OrderItemInputDto = OrderItemInputDto;
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'productId must be an integer' }),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], OrderItemInputDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'variantId must be an integer' }),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], OrderItemInputDto.prototype, "variantId", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ message: 'quantity must be an integer' }),
    (0, class_validator_1.Min)(1, { message: 'quantity must be at least 1' }),
    __metadata("design:type", Number)
], OrderItemInputDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)({ message: 'configuration must be a JSON object' }),
    __metadata("design:type", Object)
], OrderItemInputDto.prototype, "configuration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)({ message: 'modifiers must be a JSON object' }),
    __metadata("design:type", Object)
], OrderItemInputDto.prototype, "modifiers", void 0);
//# sourceMappingURL=order-item-input.dto.js.map