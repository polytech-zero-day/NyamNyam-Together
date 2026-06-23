// 후보 정렬 (domain-rules.md §5)
// sort_mode ∈ review_count(기본)/rating/random. 세션 공유. 표시 순서만 바꾼다(후보·집계 불변).
// 정렬=약한 추천(앵커링)임을 인지 → 기본값은 객관 신호(리뷰 수).

export type SortMode = 'review_count' | 'rating' | 'random';

// rating 신뢰를 위한 최소 표본 (domain-rules.md §5). 미만이면 신뢰 하향.
export const MIN_RATING_SAMPLE = 10;

export interface SortSignals {
  rating: number | null; // review_count_at_agg / rating_at_agg 스냅샷 사용
  reviewCount: number | null;
  registered: boolean; // owner/community 등록 식당 여부 (null 신호 → 후순위 배지)
}

// review_count: userRatingCount 내림차순. null/등록식당 후순위.
function compareReviewCount(a: SortSignals, b: SortSignals): number {
  const av = a.reviewCount ?? -1;
  const bv = b.reviewCount ?? -1;
  return bv - av;
}

// rating: rating 내림차순, 단 표본(userRatingCount) MIN 미만은 신뢰 하향(후순위).
function ratingScore(s: SortSignals): number {
  if (s.rating === null) return Number.NEGATIVE_INFINITY;
  if ((s.reviewCount ?? 0) < MIN_RATING_SAMPLE) return s.rating - 100; // 표본 얇음 → 강한 하향
  return s.rating;
}
function compareRating(a: SortSignals, b: SortSignals): number {
  return ratingScore(b) - ratingScore(a);
}

// 결정적 시드 셔플 (xorshift 기반). 같은 시드 → 같은 순서 (새로고침해도 고정).
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

/**
 * sort_mode에 따라 표시 순서 정렬. 원본 배열 불변(새 배열 반환).
 * @param seed random 모드용 session.sort_seed (없으면 1)
 */
export function applySortMode<T>(
  items: T[],
  mode: SortMode,
  signalsOf: (item: T) => SortSignals,
  seed = 1,
): T[] {
  if (mode === 'random') return seededShuffle(items, seed);
  const cmp = mode === 'rating' ? compareRating : compareReviewCount;
  // 안정 정렬: 동점이면 입력 순서(파이프라인 rank) 유지
  return [...items].sort((a, b) => cmp(signalsOf(a), signalsOf(b)));
}
