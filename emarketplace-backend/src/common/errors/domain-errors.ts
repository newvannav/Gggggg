import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Domain error hierarchy. Every business failure maps to an explicit HTTP
 * status; the global AllExceptionsFilter serializes them consistently and
 * never leaks internals (stack traces, SQL) to clients.
 */

export abstract class DomainError extends HttpException {
  protected constructor(status: HttpStatus, errorCode: string, message: string, details?: unknown) {
    super({ errorCode, message, details }, status);
  }
}

/** 400 — malformed coordinates, bad radius, etc. */
export class InvalidCoordinatesError extends DomainError {
  constructor(message = 'latitude/longitude are missing or outside valid ranges') {
    super(HttpStatus.BAD_REQUEST, 'INVALID_COORDINATES', message);
  }
}

/** 404 — resource does not exist or is invisible to the caller. */
export class ResourceNotFoundError extends DomainError {
  constructor(resource: string, id: string | number) {
    super(HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND', `${resource} ${String(id)} was not found`, {
      resource,
      id,
    });
  }
}

/** 401 — JWT guard rejections. */
export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentication required') {
    super(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', message);
  }
}

/** 403 — role guard rejections (non-vendor editing hours, non-driver pushing tracking). */
export class ForbiddenError extends DomainError {
  constructor(message = 'You do not have permission to perform this action') {
    super(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);
  }
}

/** 409 — vendor closed, shop inactive, illegal state transition, lost stock race. */
export class BusinessRuleViolationError extends DomainError {
  constructor(errorCode: string, message: string, details?: unknown) {
    super(HttpStatus.CONFLICT, errorCode, message, details);
  }
}

export class VendorClosedError extends BusinessRuleViolationError {
  constructor(shopId: number, opensAtIso?: string) {
    super('VENDOR_CLOSED', 'This shop is currently closed', {
      shopId,
      ...(opensAtIso !== undefined ? { opensAt: opensAtIso } : {}),
    });
  }
}

export class ShopNotAcceptingOrdersError extends BusinessRuleViolationError {
  constructor(shopId: number) {
    super('SHOP_NOT_ACCEPTING_ORDERS', 'Shop is not accepting orders right now', { shopId });
  }
}

/** 422-ish but kept as CONFLICT: stock constraint failed at checkout time. */
export class OutOfStockError extends BusinessRuleViolationError {
  constructor(productId: number, requested: number, available: number, variantSku?: string) {
    super(
      'OUT_OF_STOCK',
      `Insufficient stock for product ${String(productId)}${variantSku ? ` (SKU ${variantSku})` : ''}`,
      {
        productId,
        requested,
        available,
        ...(variantSku !== undefined ? { variantSku } : {}),
      },
    );
  }
}

/** 422 — subtotal below shop.minimumOrderAmount. */
export class MinimumOrderNotMetError extends BusinessRuleViolationError {
  constructor(minimum: string, subtotal: string) {
    super(
      'MINIMUM_ORDER_NOT_MET',
      `Order subtotal ${subtotal} is below the shop minimum ${minimum}`,
      { minimum, subtotal },
    );
  }
}

/** 422 — order placed outside allowed lead/scheduling window, bad payload semantics. */
export class UnprocessableError extends DomainError {
  constructor(errorCode: string, message: string, details?: unknown) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, errorCode, message, details);
  }
}
