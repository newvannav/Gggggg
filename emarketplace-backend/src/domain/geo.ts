/**
 * Geo value objects + pure distance math.
 *
 * NOTE ON INDICES: the production schema comments recommend PostGIS geography(Point)
 * with a GiST index for radius queries. While the columns are still plain Float
 * (latitude/longitude), discovery uses $queryRaw with either ST_DWithin/ST_DistanceSphere
 * (when the postgis extension migration has been applied) or the Haversine formula.
 * Both paths live in ShopDiscoveryRepository; this module holds the shared validation
 * and the reference Haversine used for delivery-fee recalculation in Node.
 */

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

const EARTH_MEAN_RADIUS_KM = 6371.0088;
const MIN_LAT = -90;
const MAX_LAT = 90;
const MIN_LNG = -180;
const MAX_LNG = 180;

export function isValidLatitude(lat: unknown): lat is number {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= MIN_LAT && lat <= MAX_LAT;
}

export function isValidLongitude(lng: unknown): lng is number {
  return typeof lng === 'number' && Number.isFinite(lng) && lng >= MIN_LNG && lng <= MAX_LNG;
}

export function assertValidPoint(point: GeoPoint): asserts point is GeoPoint {
  if (!isValidLatitude(point.latitude) || !isValidLongitude(point.longitude)) {
    throw new RangeError(
      `Invalid coordinates: lat=${String(point.latitude)}, lng=${String(point.longitude)}`,
    );
  }
}

/**
 * Haversine great-circle distance in kilometres.
 * Used as the DB-side fallback and mirrored here for fee recomputation/tests.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  assertValidPoint(a);
  assertValidPoint(b);

  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLng = Math.sin(dLng / 2);

  const h =
    sinHalfDLat * sinHalfDLat + Math.cos(lat1) * Math.cos(lat2) * sinHalfDLng * sinHalfDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_MEAN_RADIUS_KM * c;
}
