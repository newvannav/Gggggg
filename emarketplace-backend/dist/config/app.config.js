"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAppConfig = loadAppConfig;
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
function parseNumber(name, fallback) {
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
function loadAppConfig() {
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
//# sourceMappingURL=app.config.js.map