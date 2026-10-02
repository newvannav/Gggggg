import Decimal from 'decimal.js';

/**
 * Money value object.
 *
 * All monetary math in this codebase goes through Decimal.js with explicit
 * rounding so we never touch binary floating point for currency. The database
 * columns are DECIMAL(12,2); Prisma returns them as its own Decimal type which
 * exposes toString() — we normalize everything through Money immediately at
 * the repository boundary.
 */
export class Money {
  static readonly SCALE = 2 as const;

  private constructor(readonly value: Decimal) {}

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  /** Parse from Prisma Decimal | number | string. Numbers are routed via String() to avoid FP artifacts. */
  static from(input: { toString(): string } | string | number): Money {
    const d = new Decimal(typeof input === 'number' ? String(input) : input.toString());
    if (d.isNaN() || d.isInfinity()) {
      throw new TypeError(`Invalid monetary value: ${String(input)}`);
    }
    return new Money(d);
  }

  static fromCents(cents: number): Money {
    return new Money(new Decimal(cents).div(100));
  }

  plus(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  minus(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  times(factor: Decimal | number): Money {
    return new Money(this.value.times(factor instanceof Decimal ? factor : new Decimal(factor)));
  }

  /** Banker-friendly HALF_UP rounding to 2dp — standard for invoice line items. */
  round(): Money {
    return new Money(this.value.toDecimalPlaces(Money.SCALE, Decimal.ROUND_HALF_UP));
  }

  max(other: Money): Money {
    return new Money(Decimal.max(this.value, other.value));
  }

  gte(other: Money): boolean {
    return this.value.gte(other.value);
  }

  gt(other: Money): boolean {
    return this.value.gt(other.value);
  }

  isPositive(): boolean {
    return this.value.gt(0);
  }

  /** String with exactly 2 decimal places — the canonical form for DECIMAL(12,2) columns and API payloads. */
  toString(): string {
    return this.round().value.toFixed(Money.SCALE);
  }

  toNumber(): number {
    return Number(this.toString());
  }
}

export type MoneyJson = string;
