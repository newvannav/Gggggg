/**
 * Centralized, validated runtime configuration.
 * Fail-fast: any missing/invalid env crashes boot with a readable message.
 */

export interface PricingConfig {
  /** Base delivery fee charged for the first included km. */
  readonly deliveryBaseFee: number;
  /** Included distance before per-km surcharge kicks in (km). */
  readonly freeDistanceKm: number;
  /** Surcharge per additional km beyond freeDistanceKm. */
  readonly perKmFee: number;
  /** Hard cap on delivery fee regardless of distance. */
  readonly maxDeliveryFee: number;
  /** Minimum order lead time used for estimatedDeliveryAt (minutes). */
  readonly minPrepMinutes: number;
  /** Average urban driving speed for ETA estimation (km/h). */
  readonly avgSpeedKmh: number;
  /** Default tax rate applied to line items when product carries no explicit rate. */
  readonly defaultTaxRate: number;
}

export interface AppConfig {
  readonly port: number;
  readonly jwtSecret: string;
  readonly corsOrigin: string;
  readonly pricing: PricingConfig;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a finite number, got "${raw}"`);
  }
  return parsed;
}

export function loadAppConfig(): AppConfig {
  return {
    port: parseNumber('PORT', 3000),
    jwtSecret: requireEnv('JWT_SECRET'),
    corsOrigin: process.env['CORS_ORIGIN'] ?? '*',
    pricing: {
      deliveryBaseFee: parseNumber('DELIVERY_BASE_FEE', 2.5),
      freeDistanceKm: parseNumber('DELIVERY_FREE_KM', 2),
      perKmFee: parseNumber('DELIVERY_PER_KM', 0.9),
      maxDeliveryFee: parseNumber('DELIVERY_MAX_FEE', 15),
      minPrepMinutes: parseNumber('MIN_PREP_MINUTES', 10),
      avgSpeedKmh: parseNumber('AVG_SPEED_KMH', 28),
      defaultTaxRate: parseNumber('DEFAULT_TAX_RATE', 0),
    },
  };
}
