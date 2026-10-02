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
exports.OrderStatusTransitionDto = void 0;
const class_validator_1 = require("class-validator");
const prisma_1 = require("../../../generated/prisma");
class OrderStatusTransitionDto {
    status;
}
exports.OrderStatusTransitionDto = OrderStatusTransitionDto;
__decorate([
    (0, class_validator_1.IsEnum)(prisma_1.OrderStatus, { message: 'status must be a valid OrderStatus enum value' }),
    __metadata("design:type", String)
], OrderStatusTransitionDto.prototype, "status", void 0);
//# sourceMappingURL=order-status-transition.dto.js.map