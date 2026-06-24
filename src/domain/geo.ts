// 거리 계산 (haversine). 순수 함수.
// google 후보·등록 식당 모두 역 중심으로부터의 거리(m) 산출에 사용.
// (yang 브랜치 geo.ts 흡수 — 통합 베이스 han에 합류)

import type { Station } from './types';

const EARTH_RADIUS_M = 6_371_000;

/** 두 좌표 사이 거리(m) — haversine. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a))));
}

/** 역 중심으로부터의 거리(m). 좌표 없으면 null. */
export function distanceFromStation(
  point: { lat: number | null; lng: number | null },
  station: Station,
): number | null {
  if (point.lat == null || point.lng == null) return null;
  return haversineMeters(station.lat, station.lng, point.lat, point.lng);
}
