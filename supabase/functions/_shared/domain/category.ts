export const MIN_CATEGORY_VOTES = 2;

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
  return categories
    .filter((c) => c.name.trim().length > 0 && c.votes >= minVotes)
    .map((c) => c.name);
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
