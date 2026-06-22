// 분위기: 거르지 않음, 약한 정렬 가중치 (domain-rules.md 4장)
// mood ∈ {quiet, any}. 동점 후보 간 순위 조정용 약한 가중치.
// restaurants.mood 배열 기반. null이면 가중치 0.

export type MoodPref = 'quiet' | 'any';

const QUIET_MOOD_KEYWORD = '조용한';

// category_name 기반 quiet 장소 추론 — seed 스크립트·초기 분류용
const QUIET_CATEGORY_PREFIXES = ['카페,디저트', '카페'];

export function isQuietPlace(categoryName: string): boolean {
  return QUIET_CATEGORY_PREFIXES.some((prefix) => categoryName.startsWith(prefix));
}

// 참여자 전체 mood 응답에서 'quiet' 비율 산출
export function computeQuietRatio(moods: (MoodPref | null | undefined)[]): number {
  const valid = moods.filter((m): m is MoodPref => m === 'quiet' || m === 'any');
  if (valid.length === 0) return 0;
  return valid.filter((m) => m === 'quiet').length / valid.length;
}

/**
 * 분위기 점수: quiet 선호 다수일 때 restaurants.mood 배열에 '조용한'이 있으면 약한 보너스.
 * null이면 가중치 0 (domain-rules.md: null이면 가중치 0).
 * 카테고리 매칭(10점/개) 대비 부차적으로 낮게 유지.
 */
export function computeMoodScore(restaurantMood: string[] | null, quietRatio: number): number {
  if (!restaurantMood || quietRatio <= 0.5) return 0;
  return restaurantMood.includes(QUIET_MOOD_KEYWORD) ? 2 : 0;
}
