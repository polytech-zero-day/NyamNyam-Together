import type { MoodPref } from './types.ts';

// 분위기 점수 — 구글에 "소음/조용함" 필드가 없으므로 types/primaryType 를 대리 신호로 사용.
// moodDominant 가 'quiet' 일 때만 작동(그 외엔 0, 영향 없음).
// 스케일은 음식 매칭(CATEGORY_MATCH_POINTS=10)보다 작게 두어 음식 선호가 항상 우선하고,
// 분위기는 동점·근소차에서만 순위를 바꾸도록 한다.

const NOISY_TYPES = new Set<string>(['bar', 'pub', 'night_club', 'karaoke']);
const BORDERLINE_TYPES = new Set<string>(['bar_and_grill', 'brewery', 'wine_bar']);
const CALM_TYPES = new Set<string>([
  'cafe',
  'coffee_shop',
  'tea_house',
  'bakery',
  'fine_dining_restaurant',
  'book_store',
]);

const NOISY_PENALTY = -8;
const BORDERLINE_PENALTY = -3;
const CALM_BONUS = 3;

export function computeMoodScore(types: string[], moodDominant: MoodPref | null): number {
  if (moodDominant !== 'quiet') return 0;
  if (types.some((t) => NOISY_TYPES.has(t))) return NOISY_PENALTY;
  if (types.some((t) => BORDERLINE_TYPES.has(t))) return BORDERLINE_PENALTY;
  if (types.some((t) => CALM_TYPES.has(t))) return CALM_BONUS;
  return 0;
}
