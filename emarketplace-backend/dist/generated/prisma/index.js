"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Prisma = exports.ReviewTarget = exports.PayoutSchedule = exports.OnboardingStatus = exports.PaymentProvider = exports.PaymentStatus = exports.OrderStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["CUSTOMER"] = "CUSTOMER";
    UserRole["VENDOR"] = "VENDOR";
    UserRole["DRIVER"] = "DRIVER";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["ACCEPTED_BY_SHOP"] = "ACCEPTED_BY_SHOP";
    OrderStatus["PREPARING"] = "PREPARING";
    OrderStatus["AWAITING_PICKUP"] = "AWAITING_PICKUP";
    OrderStatus["OUT_FOR_DELIVERY"] = "OUT_FOR_DELIVERY";
    OrderStatus["DELIVERED"] = "DELIVERED";
    OrderStatus["CANCELLED"] = "CANCELLED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["UNPAID"] = "UNPAID";
    PaymentStatus["AUTHORIZED"] = "AUTHORIZED";
    PaymentStatus["PAID"] = "PAID";
    PaymentStatus["PARTIALLY_REFUNDED"] = "PARTIALLY_REFUNDED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["CANCELLED"] = "CANCELLED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var PaymentProvider;
(function (PaymentProvider) {
    PaymentProvider["STRIPE"] = "STRIPE";
    PaymentProvider["ADYEN"] = "ADYEN";
    PaymentProvider["PAYPAL"] = "PAYPAL";
    PaymentProvider["CASH"] = "CASH";
})(PaymentProvider || (exports.PaymentProvider = PaymentProvider = {}));
var OnboardingStatus;
(function (OnboardingStatus) {
    OnboardingStatus["NOT_STARTED"] = "NOT_STARTED";
    OnboardingStatus["IN_PROGRESS"] = "IN_PROGRESS";
    OnboardingStatus["PENDING_REVIEW"] = "PENDING_REVIEW";
    OnboardingStatus["COMPLETE"] = "COMPLETE";
    OnboardingStatus["REJECTED"] = "REJECTED";
})(OnboardingStatus || (exports.OnboardingStatus = OnboardingStatus = {}));
var PayoutSchedule;
(function (PayoutSchedule) {
    PayoutSchedule["DAILY"] = "DAILY";
    PayoutSchedule["WEEKLY"] = "WEEKLY";
    PayoutSchedule["BIWEEKLY"] = "BIWEEKLY";
    PayoutSchedule["MONTHLY"] = "MONTHLY";
})(PayoutSchedule || (exports.PayoutSchedule = PayoutSchedule = {}));
var ReviewTarget;
(function (ReviewTarget) {
    ReviewTarget["SHOP"] = "SHOP";
    ReviewTarget["DRIVER"] = "DRIVER";
})(ReviewTarget || (exports.ReviewTarget = ReviewTarget = {}));
var Prisma;
(function (Prisma) {
    class PrismaClientKnownRequestError extends Error {
        code;
        meta;
        clientVersion;
        constructor(message, init) {
            super(message);
            this.name = 'PrismaClientKnownRequestError';
            this.code = init.code;
            this.meta = init.meta;
            this.clientVersion = init.clientVersion;
        }
    }
    Prisma.PrismaClientKnownRequestError = PrismaClientKnownRequestError;
    class Decimal {
        value;
        constructor(value) {
            this.value = String(value);
        }
        toString() {
            return this.value;
        }
        toNumber() {
            return Number(this.value);
        }
    }
    Prisma.Decimal = Decimal;
    class Sql {
        strings;
        values;
        constructor(strings, values) {
            this.strings = strings;
            this.values = values;
        }
    }
    Prisma.Sql = Sql;
    function sql(strings, ...values) {
        return new Sql(strings, values);
    }
    Prisma.sql = sql;
})(Prisma || (exports.Prisma = Prisma = {}));
//# sourceMappingURL=index.js.map