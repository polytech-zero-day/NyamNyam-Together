export type SortMode = 'review_count' | 'rating' | 'random';

export const MIN_RATING_SAMPLE = 10;

export interface SortSignals {
  rating: number | null;
  reviewCount: number | null;
  registered: boolean;
}

function compareReviewCount(a: SortSignals, b: SortSignals): number {
  const av = a.reviewCount ?? -1;
  const bv = b.reviewCount ?? -1;
  return bv - av;
}

function ratingScore(s: SortSignals): number {
  if (s.rating === null) return Number.NEGATIVE_INFINITY;
  if ((s.reviewCount ?? 0) < MIN_RATING_SAMPLE) return s.rating - 100;
  return s.rating;
}
function compareRating(a: SortSignals, b: SortSignals): number {
  return ratingScore(b) - ratingScore(a);
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let state = seed | 0 || 1;
  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function applySortMode<T>(
  items: T[],
  mode: SortMode,
  signalsOf: (item: T) => SortSignals,
  seed = 1,
): T[] {
  if (mode === 'random') return seededShuffle(items, seed);
  const cmp = mode === 'rating' ? compareRating : compareReviewCount;
  return [...items].sort((a, b) => cmp(signalsOf(a), signalsOf(b)));
}
