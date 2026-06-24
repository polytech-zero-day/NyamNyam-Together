import type { Station } from './types.ts';

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a))));
}

export function distanceFromStation(
  point: { lat: number | null; lng: number | null },
  station: Station,
): number | null {
  if (point.lat == null || point.lng == null) return null;
  return haversineMeters(station.lat, station.lng, point.lat, point.lng);
}
