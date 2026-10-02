"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Money = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
class Money {
    value;
    static SCALE = 2;
    constructor(value) {
        this.value = value;
    }
    static zero() {
        return new Money(new decimal_js_1.default(0));
    }
    static from(input) {
        const d = new decimal_js_1.default(typeof input === 'number' ? String(input) : input.toString());
        if (d.isNaN() || !d.isFinite()) {
            throw new TypeError(`Invalid monetary value: ${String(input)}`);
        }
        return new Money(d);
    }
    static fromCents(cents) {
        return new Money(new decimal_js_1.default(cents).div(100));
    }
    plus(other) {
        return new Money(this.value.plus(other.value));
    }
    minus(other) {
        return new Money(this.value.minus(other.value));
    }
    times(factor) {
        return new Money(this.value.times(factor instanceof decimal_js_1.default ? factor : new decimal_js_1.default(factor)));
    }
    round() {
        return new Money(this.value.toDecimalPlaces(Money.SCALE, decimal_js_1.default.ROUND_HALF_UP));
    }
    max(other) {
        return new Money(decimal_js_1.default.max(this.value, other.value));
    }
    gte(other) {
        return this.value.gte(other.value);
    }
    gt(other) {
        return this.value.gt(other.value);
    }
    isPositive() {
        return this.value.gt(0);
    }
    toString() {
        return this.round().value.toFixed(Money.SCALE);
    }
    toNumber() {
        return Number(this.toString());
    }
}
exports.Money = Money;
//# sourceMappingURL=money.js.map