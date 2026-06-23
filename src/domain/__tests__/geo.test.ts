import { haversineMeters, distanceFromStation } from '../geo';
import type { Station } from '../types';

const gangnam: Station = { id: 'gangnam', lat: 37.497942, lng: 127.027621 };

describe('haversineMeters', () => {
  it('같은 좌표 → 0m', () => {
    expect(haversineMeters(37.5, 127.0, 37.5, 127.0)).toBe(0);
  });

  it('대칭성 (a→b == b→a)', () => {
    const ab = haversineMeters(37.5, 127.0, 37.51, 127.01);
    const ba = haversineMeters(37.51, 127.01, 37.5, 127.0);
    expect(ab).toBe(ba);
  });

  it('알려진 근사 거리 (위도 0.01° ≈ 1.11km)', () => {
    const d = haversineMeters(37.5, 127.0, 37.51, 127.0);
    expect(d).toBeGreaterThan(1050);
    expect(d).toBeLessThan(1160);
  });
});

describe('distanceFromStation', () => {
  it('좌표 있으면 거리(m) 정수', () => {
    const d = distanceFromStation({ lat: 37.5, lng: 127.03 }, gangnam);
    expect(d).not.toBeNull();
    expect(Number.isInteger(d)).toBe(true);
    expect(d!).toBeGreaterThan(0);
  });

  it('좌표 null이면 null (등록 식당 좌표 미입력 등)', () => {
    expect(distanceFromStation({ lat: null, lng: 127.0 }, gangnam)).toBeNull();
    expect(distanceFromStation({ lat: 37.5, lng: null }, gangnam)).toBeNull();
  });
});
