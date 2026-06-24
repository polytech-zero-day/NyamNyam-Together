import { longevityScore } from '../longevity';

const asOf = new Date('2026-06-23T00:00:00Z');

describe('longevityScore — 등록 식당 open_date 약한 가점', () => {
  it('open_date null → 0', () => {
    expect(longevityScore(null, asOf)).toBe(0);
  });

  it('잘못된 날짜 → 0', () => {
    expect(longevityScore('not-a-date', asOf)).toBe(0);
  });

  it('미래 개업(음수 연차) → 0', () => {
    expect(longevityScore('2027-01-01', asOf)).toBe(0);
  });

  it('오래 운영할수록 점수 증가, 상한 3점', () => {
    const young = longevityScore('2025-06-23', asOf); // ~1년 → 0.5
    const mid = longevityScore('2022-06-23', asOf); // ~4년 → 2.0
    const old = longevityScore('2000-01-01', asOf); // 상한
    expect(young).toBeCloseTo(0.5, 1);
    expect(mid).toBeCloseTo(2.0, 1);
    expect(old).toBe(3);
  });

  it('카테고리 매칭(10점)보다 약함', () => {
    expect(longevityScore('1990-01-01', asOf)).toBeLessThan(10);
  });
});
