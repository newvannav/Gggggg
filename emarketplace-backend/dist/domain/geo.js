"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidLatitude = isValidLatitude;
exports.isValidLongitude = isValidLongitude;
exports.assertValidPoint = assertValidPoint;
exports.haversineKm = haversineKm;
const EARTH_MEAN_RADIUS_KM = 6371.0088;
const MIN_LAT = -90;
const MAX_LAT = 90;
const MIN_LNG = -180;
const MAX_LNG = 180;
function isValidLatitude(lat) {
    return typeof lat === 'number' && Number.isFinite(lat) && lat >= MIN_LAT && lat <= MAX_LAT;
}
function isValidLongitude(lng) {
    return typeof lng === 'number' && Number.isFinite(lng) && lng >= MIN_LNG && lng <= MAX_LNG;
}
function assertValidPoint(point) {
    if (!isValidLatitude(point.latitude) || !isValidLongitude(point.longitude)) {
        throw new RangeError(`Invalid coordinates: lat=${String(point.latitude)}, lng=${String(point.longitude)}`);
    }
}
function haversineKm(a, b) {
    assertValidPoint(a);
    assertValidPoint(b);
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const sinHalfDLat = Math.sin(dLat / 2);
    const sinHalfDLng = Math.sin(dLng / 2);
    const h = sinHalfDLat * sinHalfDLat + Math.cos(lat1) * Math.cos(lat2) * sinHalfDLng * sinHalfDLng;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return EARTH_MEAN_RADIUS_KM * c;
}
//# sourceMappingURL=geo.js.map