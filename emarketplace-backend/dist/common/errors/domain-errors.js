"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnprocessableError = exports.MinimumOrderNotMetError = exports.OutOfStockError = exports.ShopNotAcceptingOrdersError = exports.VendorClosedError = exports.BusinessRuleViolationError = exports.ForbiddenError = exports.UnauthorizedError = exports.ResourceNotFoundError = exports.InvalidCoordinatesError = exports.DomainError = void 0;
const common_1 = require("@nestjs/common");
class DomainError extends common_1.HttpException {
    constructor(status, errorCode, message, details) {
        super({ errorCode, message, details }, status);
    }
}
exports.DomainError = DomainError;
class InvalidCoordinatesError extends DomainError {
    constructor(message = 'latitude/longitude are missing or outside valid ranges') {
        super(common_1.HttpStatus.BAD_REQUEST, 'INVALID_COORDINATES', message);
    }
}
exports.InvalidCoordinatesError = InvalidCoordinatesError;
class ResourceNotFoundError extends DomainError {
    constructor(resource, id) {
        super(common_1.HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND', `${resource} ${String(id)} was not found`, {
            resource,
            id,
        });
    }
}
exports.ResourceNotFoundError = ResourceNotFoundError;
class UnauthorizedError extends DomainError {
    constructor(message = 'Authentication required') {
        super(common_1.HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', message);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends DomainError {
    constructor(message = 'You do not have permission to perform this action') {
        super(common_1.HttpStatus.FORBIDDEN, 'FORBIDDEN', message);
    }
}
exports.ForbiddenError = ForbiddenError;
class BusinessRuleViolationError extends DomainError {
    constructor(errorCode, message, details) {
        super(common_1.HttpStatus.CONFLICT, errorCode, message, details);
    }
}
exports.BusinessRuleViolationError = BusinessRuleViolationError;
class VendorClosedError extends BusinessRuleViolationError {
    constructor(shopId, opensAtIso) {
        super('VENDOR_CLOSED', 'This shop is currently closed', {
            shopId,
            ...(opensAtIso !== undefined ? { opensAt: opensAtIso } : {}),
        });
    }
}
exports.VendorClosedError = VendorClosedError;
class ShopNotAcceptingOrdersError extends BusinessRuleViolationError {
    constructor(shopId) {
        super('SHOP_NOT_ACCEPTING_ORDERS', 'Shop is not accepting orders right now', { shopId });
    }
}
exports.ShopNotAcceptingOrdersError = ShopNotAcceptingOrdersError;
class OutOfStockError extends BusinessRuleViolationError {
    constructor(productId, requested, available, variantSku) {
        super('OUT_OF_STOCK', `Insufficient stock for product ${String(productId)}${variantSku ? ` (SKU ${variantSku})` : ''}`, {
            productId,
            requested,
            available,
            ...(variantSku !== undefined ? { variantSku } : {}),
        });
    }
}
exports.OutOfStockError = OutOfStockError;
class MinimumOrderNotMetError extends BusinessRuleViolationError {
    constructor(minimum, subtotal) {
        super('MINIMUM_ORDER_NOT_MET', `Order subtotal ${subtotal} is below the shop minimum ${minimum}`, { minimum, subtotal });
    }
}
exports.MinimumOrderNotMetError = MinimumOrderNotMetError;
class UnprocessableError extends DomainError {
    constructor(errorCode, message, details) {
        super(common_1.HttpStatus.UNPROCESSABLE_ENTITY, errorCode, message, details);
    }
}
exports.UnprocessableError = UnprocessableError;
//# sourceMappingURL=domain-errors.js.map