// 음식 카테고리 (domain-rules.md §3)
// ★ "2표 이상 채택" 임계는 우리 소유. 채택 카테고리 ↔ 식당 google types 매칭 점수(정렬용, 필터 아님).

export const MIN_CATEGORY_VOTES = 2;

// 한글 분류 ↔ google types — 프론트/기능정의서 8개 카테고리 단일 정본. 매핑은 범용성 넓게.
// (없는 google type은 매칭만 안 될 뿐 에러 아님 → 넓게 둬도 안전)
const CATEGORY_TYPE_MAP: Record<string, string[]> = {
  한식: ['korean_restaurant'],
  일식: ['japanese_restaurant', 'sushi_restaurant', 'ramen_restaurant'],
  양식: [
    'italian_restaurant',
    'american_restaurant',
    'french_restaurant',
    'steak_house',
    'pizza_restaurant',
    'hamburger_restaurant',
    'spanish_restaurant',
  ],
  중식: ['chinese_restaurant'],
  분식: ['korean_restaurant'], // 전용 type 없음 → 한식 fallback
  아시안: [
    'asian_restaurant',
    'thai_restaurant',
    'vietnamese_restaurant',
    'indian_restaurant',
    'indonesian_restaurant',
    'middle_eastern_restaurant',
  ],
  '고기·구이': ['barbecue_restaurant', 'korean_restaurant'],
  '카페·브런치': [
    'cafe',
    'coffee_shop',
    'bakery',
    'brunch_restaurant',
    'breakfast_restaurant',
    'dessert_restaurant',
  ],
};

export function googleTypesForCategory(korean: string): string[] {
  return CATEGORY_TYPE_MAP[korean] ?? [];
}

/**
 * B가 넘긴 categories(name, votes)에서 2표 이상만 채택 (합집합 폭발 방지).
 * 임계 판단은 추천 로직(우리 소유).
 */
export function getEligibleCategories(
  categories: { name: string; votes: number }[],
  minVotes: number = MIN_CATEGORY_VOTES,
): string[] {
  return categories
    .filter((c) => c.name.trim().length > 0 && c.votes >= minVotes)
    .map((c) => c.name);
}

// 매칭 점수: 채택 카테고리(한글)의 매핑 types와 후보 types가 겹치면 카테고리당 10점.
// eligibleCategories 비어있으면 0점(전 후보 동점). 필터 아님 — 정렬 가중치.
const CATEGORY_MATCH_POINTS = 10;

export function scoreByCategoryMatch(
  candidateTypes: string[],
  eligibleCategories: string[],
): number {
  if (eligibleCategories.length === 0) return 0;
  const typeSet = new Set(candidateTypes);
  let score = 0;
  for (const korean of eligibleCategories) {
    if (googleTypesForCategory(korean).some((t) => typeSet.has(t))) {
      score += CATEGORY_MATCH_POINTS;
    }
  }
  return score;
}
