import { InjectionToken } from '@angular/core';

export interface GoogleMapsConfig {
  readonly apiKey: string;
  readonly mapsId: string | undefined;
  readonly languageCode: string;
  readonly regionCode: string;
}

export const GOOGLE_MAPS_CONFIG = new InjectionToken<GoogleMapsConfig>('GOOGLE_MAPS_CONFIG');

/** Minimal shape the <google-map> wrapper consumes for any point of interest. */
export interface MapMarkerPoint {
  /** Optional stable identity (used for banner de-duplication). */
  readonly id?: string;
  readonly lat: number;
  readonly lng: number;
  readonly label?: string;
  /** Optional custom icon URL; falls back to the shop logo / default pin. */
  readonly iconUrl?: string | null;
}

export interface MarkerCluster<T extends MapMarkerPoint> {
  readonly center: { lat: number; lng: number };
  readonly count: number;
  readonly points: readonly T[];
}
