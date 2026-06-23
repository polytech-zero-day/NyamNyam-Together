import { bandOf, filterByBudgetMax, budgetMinPenalty } from '../budget';
import type { Candidate } from '../types';

const cand = (priceLevel: number | null): Candidate => ({
  ref: `p${priceLevel}`,
  placeId: null,
  source: 'google',
  types: ['restaurant'],
  primaryType: 'restaurant',
  priceLevel,
  rating: null,
  userRatingCount: null,
  name: null,
  distanceM: null,
  placeTypeOverride: null,
  categoryKorean: null,
  openDate: null,
});

describe('bandOf — 금액 → priceLevel 밴드', () => {
  it('경계값', () => {
    expect(bandOf(11_999)).toBe(1);
    expect(bandOf(12_000)).toBe(2);
    expect(bandOf(24_999)).toBe(2);
    expect(bandOf(25_000)).toBe(3);
    expect(bandOf(49_999)).toBe(3);
    expect(bandOf(50_000)).toBe(4);
    expect(bandOf(100_000)).toBe(4);
  });
});

describe('filterByBudgetMax — max 주력 필터', () => {
  it('priceLevel ≤ bandOf(budgetMax) 통과', () => {
    const candidates = [cand(1), cand(2), cand(3), cand(4)];
    // budgetMax 25_000 → band 3 → priceLevel 1,2,3 통과, 4 탈락
    const result = filterByBudgetMax(candidates, 25_000);
    expect(result.map((c) => c.priceLevel)).toEqual([1, 2, 3]);
  });

  it('priceLevel null → 통과 (필터 미적용)', () => {
    const result = filterByBudgetMax([cand(null), cand(4)], 12_000); // band 2
    expect(result.map((c) => c.priceLevel)).toEqual([null]); // null 통과, 4 탈락
  });

  it('낮은 예산이면 비싼 곳 전부 탈락', () => {
    expect(filterByBudgetMax([cand(2), cand(3), cand(4)], 5_000)).toHaveLength(0); // band 1
  });
});

describe('budgetMinPenalty — min 소프트 감점', () => {
  it('하한 밴드 미만 → 감점', () => {
    // budgetMin 25_000 → band 3. priceLevel 1,2는 미만 → 감점
    expect(budgetMinPenalty(1, 25_000)).toBeGreaterThan(0);
    expect(budgetMinPenalty(2, 25_000)).toBeGreaterThan(0);
  });

  it('하한 밴드 이상 → 감점 없음', () => {
    expect(budgetMinPenalty(3, 25_000)).toBe(0);
    expect(budgetMinPenalty(4, 25_000)).toBe(0);
  });

  it('priceLevel null → 감점 없음', () => {
    expect(budgetMinPenalty(null, 50_000)).toBe(0);
  });
});
