import { applySortMode, SortSignals, MIN_RATING_SAMPLE } from '../sort';

const sig = (rating: number | null, reviewCount: number | null, registered = false): SortSignals => ({
  rating,
  reviewCount,
  registered,
});

const idOf = (s: SortSignals): string => `${s.rating}/${s.reviewCount}`;

describe('applySortMode — review_count (기본)', () => {
  it('userRatingCount 내림차순, null 후순위', () => {
    const items = [sig(4.0, 10), sig(4.9, 100), sig(4.5, null)];
    const sorted = applySortMode(items, 'review_count', (x) => x);
    expect(sorted.map((s) => s.reviewCount)).toEqual([100, 10, null]);
  });

  it('원본 불변', () => {
    const items = [sig(4.0, 10), sig(4.9, 100)];
    applySortMode(items, 'review_count', (x) => x);
    expect(items.map((s) => s.reviewCount)).toEqual([10, 100]);
  });
});

describe('applySortMode — rating (표본 보정)', () => {
  it('표본 충분하면 rating 내림차순', () => {
    const items = [sig(4.2, 50), sig(4.8, 80)];
    const sorted = applySortMode(items, 'rating', (x) => x);
    expect(sorted.map(idOf)).toEqual(['4.8/80', '4.2/50']);
  });

  it('표본 얇은 고평점은 신뢰 하향 → 후순위', () => {
    // 4.9(리뷰 3개, MIN 미만) vs 4.3(리뷰 50개) → 4.3이 앞
    const items = [sig(4.9, MIN_RATING_SAMPLE - 7), sig(4.3, 50)];
    const sorted = applySortMode(items, 'rating', (x) => x);
    expect(sorted[0].rating).toBe(4.3);
  });

  it('rating null → 최후순위', () => {
    const items = [sig(null, 100), sig(3.0, 20)];
    const sorted = applySortMode(items, 'rating', (x) => x);
    expect(sorted[0].rating).toBe(3.0);
  });
});

describe('applySortMode — random (시드 결정적)', () => {
  it('같은 시드 → 같은 순서 (재현성)', () => {
    const items = Array.from({ length: 8 }, (_, i) => sig(i, i));
    const a = applySortMode(items, 'random', (x) => x, 42);
    const b = applySortMode(items, 'random', (x) => x, 42);
    expect(a.map(idOf)).toEqual(b.map(idOf));
  });

  it('다른 시드 → (대개) 다른 순서, 같은 원소 집합', () => {
    const items = Array.from({ length: 8 }, (_, i) => sig(i, i));
    const a = applySortMode(items, 'random', (x) => x, 1);
    const b = applySortMode(items, 'random', (x) => x, 999);
    expect(new Set(a.map(idOf))).toEqual(new Set(b.map(idOf)));
    expect(a.map(idOf)).not.toEqual(b.map(idOf));
  });
});
