// 술 수용도 → 장소타입 분류 및 필터 (domain-rules.md §1)
// 입력은 구글 `types`/`primaryType`. 카카오 category_name 매핑 폐기.

import type { Candidate, PlaceType } from './types';

// google types/primaryType → place_type 매핑 (domain-rules.md §1 표)
// drink_required: 술이 주목적
const DRINK_REQUIRED_TYPES = new Set<string>(['bar', 'pub', 'wine_bar', 'night_club']);
// compatible: 음식+술 양립 (한식 고깃집/포차는 보강 룩업 — TODO)
const COMPATIBLE_TYPES = new Set<string>(['barbecue_restaurant', 'brewery', 'bar_and_grill']);
// general: 그 외 *_restaurant, cafe, bakery, coffee_shop, restaurant (기본값)

/**
 * 구글 types/primaryType → 우리 place_type 분류.
 * primaryType 우선, 그다음 types 배열. 매칭 없으면 general.
 */
export function classifyPlaceType(types: string[], primaryType?: string | null): PlaceType {
  const all = [primaryType, ...types].filter(
    (t): t is string => typeof t === 'string' && t.length > 0,
  );
  if (all.some((t) => DRINK_REQUIRED_TYPES.has(t))) return 'drink_required';
  if (all.some((t) => COMPATIBLE_TYPES.has(t))) return 'compatible';
  return 'general';
}

/**
 * 후보의 place_type 결정: 등록(owner/community) 식당은 등록 분류(placeTypeOverride) 우선,
 * google 식당은 types로 분류.
 */
export function placeTypeOf(c: Candidate): PlaceType {
  if (c.placeTypeOverride) return c.placeTypeOverride;
  return classifyPlaceType(c.types, c.primaryType);
}

export interface DrinkDistribution {
  drinker: number;
  ok: number;
  uncomfortable: number;
}

/**
 * 술 분포 → 허용 장소타입 집합 (domain-rules.md §1)
 *
 * | 조합                          | 허용 place_type                              |
 * |-------------------------------|----------------------------------------------|
 * | uncomfortable ≥ 1             | general 위주                                 |
 * | drinker만 (ok·uncomfortable=0)| drink_required + compatible + general        |
 * | 그 외(ok 포함, uncomfortable=0)| compatible + general                         |
 */
export function allowedPlaceTypes(drink: DrinkDistribution): Set<PlaceType> {
  if (drink.uncomfortable >= 1) {
    return new Set<PlaceType>(['general']);
  }
  if (drink.drinker > 0 && drink.ok === 0) {
    return new Set<PlaceType>(['drink_required', 'compatible', 'general']);
  }
  return new Set<PlaceType>(['compatible', 'general']);
}

// 술 제약 필터 (끝까지 유지 — 완화하지 않음, domain-rules.md §7)
export function filterByPlaceType(candidates: Candidate[], drink: DrinkDistribution): Candidate[] {
  const allowed = allowedPlaceTypes(drink);
  return candidates.filter((c) => allowed.has(placeTypeOf(c)));
}
