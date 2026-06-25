// 소규모 모임에선 취향이 1명씩 갈리기 쉬우므로, 1표 이상 받은 카테고리는 모두 반영한다.
// (예: 분식·고기·아시안 각 1표 → 셋 다 채택)
export const MIN_CATEGORY_VOTES = 1;

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
  분식: ['korean_restaurant'],
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

export function getEligibleCategories(
  categories: { name: string; votes: number }[],
  minVotes: number = MIN_CATEGORY_VOTES,
): string[] {
  const named = categories.filter((c) => c.name.trim().length > 0);
  const eligible = named.filter((c) => c.votes >= minVotes).map((c) => c.name);
  if (eligible.length > 0) return eligible;

  // 폴백: 임계(2표)에 도달한 카테고리가 하나도 없으면(소규모 모임에서 취향이 갈린 경우)
  // 선호를 통째로 버리지 않고 최다 득표 카테고리 1개만 채택한다.
  const top = named.reduce<{ name: string; votes: number } | null>(
    (best, c) => (best === null || c.votes > best.votes ? c : best),
    null,
  );
  return top ? [top.name] : [];
}

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
