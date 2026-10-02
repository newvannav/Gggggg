import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';
import { AppConfig, PricingConfig } from '../config/app.config';
import { haversineKm, GeoPoint } from './geo';
import { Money } from './money';

/**
 * Pure pricing policy engine — no DB access, trivially unit-testable.
 *
 * Delivery fee model (distance-based, capped):
 *   fee = baseFee                                  for d <= freeDistanceKm
 *   fee = baseFee + perKmFee * (d - freeDistance)  beyond that, clamped to maxDeliveryFee
 *
 * Commission & tax snapshots come from VendorPayoutProfile.commissionRate /
 * fixedCommissionPerOrder and per-line taxRate so historical orders never
 * re-price when platform or vendor rates change later.
 */
@Injectable()
export class PricingService {
  private readonly pricing: PricingConfig;

  constructor(config: ConfigService<AppConfig>) {
    const loaded = config.getOrThrow<AppConfig['pricing']>('pricing');
    this.pricing = loaded;
  }

  /** Distance-based delivery fee between two coordinates. */
  deliveryFeeForDistance(distanceKm: number): Money {
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      throw new RangeError(`distanceKm must be a non-negative finite number, got ${String(distanceKm)}`);
    }
    const p = this.pricing;
    const billableExcess = new Decimal(distanceKm).minus(p.freeDistanceKm).clamp(0, Infinity);
    const raw = new Decimal(p.deliveryBaseFee).plus(billableExcess.times(p.perKmFee));
    const capped = Decimal.min(raw, new Decimal(p.maxDeliveryFee));
    return Money.from(capped.toString()).round();
  }

  /** Convenience: fee straight from coordinates (used by discovery endpoint). */
  quoteDelivery(from: GeoPoint, to: GeoPoint): { fee: Money; distanceKm: number; etaMinutes: number } {
    const distanceKm = haversineKm(from, to);
    return {
      fee: this.deliveryFeeForDistance(distanceKm),
      distanceKm: roundTo2(distanceKm),
      etaMinutes: this.estimateEtaMinutes(distanceKm),
    };
  }

  /** Rough ETA: prep time floor + travel at configured average speed. */
  estimateEtaMinutes(distanceKm: number, shopPrepMinutes?: number | null): number {
    const prep = shopPrepMinutes ?? this.pricing.minPrepMinutes;
    const travelMinutes = (distanceKm / this.pricing.avgSpeedKmh) * 60;
    return Math.max(5, Math.ceil(prep + travelMinutes));
  }

  /**
   * Platform commission on an order's subtotal.
   * commission = round(subtotal * rate) + fixedCommissionPerOrder
   */
  platformServiceFee(subtotal: Money, commissionRate: string, fixedCommission: string): Money {
    const pct = subtotal.times(new Decimal(commissionRate)).round();
    return pct.plus(Money.from(fixedCommission).round());
  }

  /** Per-line tax amount: round(lineTotal * taxRate). Null rate -> defaultTaxRate. */
  lineTax(lineTotal: Money, taxRate: string | null): { rate: Money; amount: Money } {
    const rateStr = taxRate ?? String(this.pricing.defaultTaxRate);
    const amount = lineTotal.times(new Decimal(rateStr)).round();
    return { rate: Money.from(rateStr), amount };
  }

  /**
   * Final vendor payout = subtotal - commission.
   * Taxes are remitted by the platform on the vendor's behalf; deliveryFee is
   * carrier revenue and tip goes to the driver — all three excluded here.
   */
  netVendorPayout(subtotal: Money, platformServiceFee: Money): Money {
    return subtotal.minus(platformServiceFee).round().max(Money.zero());
  }
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}
