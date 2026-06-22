// 술 수용도 → 장소타입 분류 및 필터
// domain-rules.md 1장 기준

export type DrinkPref = 'drinker' | 'ok' | 'uncomfortable';
export type PlaceType = 'drink_required' | 'compatible' | 'general';

// category_name 접두어 → place_type 룩업 (긴 접두어 우선)
// 표기 변형 대응: 주점/바 등 보강 필요 (domain-rules.md 주석 참고)
const CATEGORY_PLACE_TYPE_MAP: Array<[string, PlaceType]> = [
  // drink_required: 칵테일바, 와인바, LP바, 펍 등 술이 주목적
  ['주점 > 칵테일바', 'drink_required'],
  ['주점 > 와인바', 'drink_required'],
  ['주점 > LP바', 'drink_required'],
  ['주점 > 바,호프', 'drink_required'], // "바" 포함 조합
  ['주점 > 바', 'drink_required'],
  ['주점 > 펍', 'drink_required'],
  // compatible: 음식+술 양립 — 포차, 고깃집, 이자카야, 호프, 곱창 등
  ['주점 > 이자카야', 'compatible'],
  ['주점 > 호프,통닭', 'compatible'],
  ['주점 > 포장마차', 'compatible'],
  ['주점 > 실내포차', 'compatible'],
  ['음식점 > 한식 > 육류,고기', 'compatible'],
  ['음식점 > 한식 > 곱창,막창', 'compatible'],
  ['주점', 'compatible'], // 분류 안 된 기타 주점 → compatible
  // general: 한식·파스타·중식·분식·카페 등
  ['음식점', 'general'],
  ['카페,디저트', 'general'],
  ['카페', 'general'],
];

export function classifyPlaceType(categoryName: string): PlaceType {
  for (const [prefix, type] of CATEGORY_PLACE_TYPE_MAP) {
    if (categoryName.startsWith(prefix)) return type;
  }
  return 'general';
}

/**
 * 참여자 술 수용도 → 허용 장소타입 집합
 *
 * | 조합                      | 허용 place_type                              |
 * |---------------------------|----------------------------------------------|
 * | ① 포함 & ③ 없음           | drink_required + compatible + general (전부) |
 * | ②만 / ①+② (③ 없음)       | compatible + general (drink_required 제외)   |
 * | ③ 1명이라도               | general 위주                                 |
 */
export function allowedPlaceTypes(prefs: DrinkPref[]): Set<PlaceType> {
  if (prefs.includes('uncomfortable')) {
    return new Set<PlaceType>(['general']);
  }
  // 전원 drinker(①)일 때만 술집 포함 전부 허용
  // ①+② 혼재 시 → compatible + general (drink_required 제외)
  if (prefs.length > 0 && prefs.every((p) => p === 'drinker')) {
    return new Set<PlaceType>(['drink_required', 'compatible', 'general']);
  }
  return new Set<PlaceType>(['compatible', 'general']);
}

export function filterByPlaceType<T extends { category_name: string }>(
  places: T[],
  prefs: DrinkPref[],
): T[] {
  const allowed = allowedPlaceTypes(prefs);
  return places.filter((p) => allowed.has(classifyPlaceType(p.category_name)));
}
