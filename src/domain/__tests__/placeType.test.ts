import { classifyPlaceType, allowedPlaceTypes, filterByPlaceType, placeTypeOf } from '../placeType';
import { googleTypesForCategory } from '../category';
import type { Candidate, PlaceType } from '../types';

const cand = (types: string[], overrides: Partial<Candidate> = {}): Candidate => ({
  ref: types.join(','),
  placeId: null,
  source: 'google',
  types,
  primaryType: types[0] ?? null,
  priceLevel: null,
  rating: null,
  userRatingCount: null,
  name: null,
  distanceM: null,
  placeTypeOverride: null,
  categoryKorean: null,
  openDate: null,
  ...overrides,
});

describe('classifyPlaceType (google types)', () => {
  it('drink_required: bar/pub/wine_bar/night_club', () => {
    expect(classifyPlaceType(['bar'])).toBe('drink_required');
    expect(classifyPlaceType(['pub'])).toBe('drink_required');
    expect(classifyPlaceType(['wine_bar'])).toBe('drink_required');
    expect(classifyPlaceType(['night_club'])).toBe('drink_required');
  });

  it('compatible: barbecue/brewery/bar_and_grill', () => {
    expect(classifyPlaceType(['barbecue_restaurant'])).toBe('compatible');
    expect(classifyPlaceType(['brewery'])).toBe('compatible');
    expect(classifyPlaceType(['bar_and_grill'])).toBe('compatible');
  });

  it('general: 그 외 식당/카페', () => {
    expect(classifyPlaceType(['korean_restaurant'])).toBe('general');
    expect(classifyPlaceType(['cafe'])).toBe('general');
    expect(classifyPlaceType(['restaurant'])).toBe('general');
  });

  it('primaryType 우선 + 빈 입력 → general', () => {
    expect(classifyPlaceType(['korean_restaurant'], 'bar')).toBe('drink_required');
    expect(classifyPlaceType([])).toBe('general');
    expect(classifyPlaceType([''], '')).toBe('general');
  });

  it('drink_required가 compatible보다 우선', () => {
    expect(classifyPlaceType(['barbecue_restaurant', 'bar'])).toBe('drink_required');
  });
});

// owner/community 등록 식당: 한글 category → google types → place_type 계산 (routes/places.ts)
describe('등록 식당 place_type 계산 (category 경유, general 폴백)', () => {
  const fromCategory = (korean: string): PlaceType =>
    classifyPlaceType(googleTypesForCategory(korean));

  it('고기·구이 → compatible (barbecue 매핑)', () => {
    expect(fromCategory('고기·구이')).toBe('compatible');
  });
  it('한식/일식/양식/중식/아시안/카페·브런치 → general', () => {
    for (const c of ['한식', '일식', '양식', '중식', '아시안', '카페·브런치']) {
      expect(fromCategory(c)).toBe('general');
    }
  });
  it('미지/빈 category → general 폴백', () => {
    expect(fromCategory('죽')).toBe('general');
    expect(fromCategory('')).toBe('general');
  });
});

describe('placeTypeOf (등록 override 우선)', () => {
  it('owner placeTypeOverride 우선', () => {
    const c = cand(['korean_restaurant'], { source: 'owner', placeTypeOverride: 'compatible' });
    expect(placeTypeOf(c)).toBe('compatible');
  });
  it('override 없으면 types로 분류', () => {
    expect(placeTypeOf(cand(['bar']))).toBe('drink_required');
  });
});

describe('allowedPlaceTypes (분포)', () => {
  it('uncomfortable ≥ 1 → general만', () => {
    expect(allowedPlaceTypes({ drinker: 2, ok: 1, uncomfortable: 1 })).toEqual(
      new Set(['general']),
    );
    expect(allowedPlaceTypes({ drinker: 0, ok: 0, uncomfortable: 1 })).toEqual(
      new Set(['general']),
    );
  });

  it('drinker만 → 전부', () => {
    expect(allowedPlaceTypes({ drinker: 3, ok: 0, uncomfortable: 0 })).toEqual(
      new Set(['drink_required', 'compatible', 'general']),
    );
  });

  it('ok 포함(uncomfortable=0) → compatible + general', () => {
    expect(allowedPlaceTypes({ drinker: 2, ok: 1, uncomfortable: 0 })).toEqual(
      new Set(['compatible', 'general']),
    );
    expect(allowedPlaceTypes({ drinker: 0, ok: 2, uncomfortable: 0 })).toEqual(
      new Set(['compatible', 'general']),
    );
  });

  it('전원 무응답(0,0,0) → compatible + general', () => {
    expect(allowedPlaceTypes({ drinker: 0, ok: 0, uncomfortable: 0 })).toEqual(
      new Set(['compatible', 'general']),
    );
  });
});

describe('filterByPlaceType', () => {
  const candidates = [
    cand(['korean_restaurant']),
    cand(['cafe']),
    cand(['barbecue_restaurant']), // compatible
    cand(['bar']), // drink_required
    cand(['wine_bar']), // drink_required
  ];

  it('uncomfortable → general만', () => {
    const result = filterByPlaceType(candidates, { drinker: 1, ok: 0, uncomfortable: 1 });
    expect(
      result.every((c) => (['korean_restaurant', 'cafe'] as string[]).includes(c.types[0])),
    ).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('drinker만 → 전부', () => {
    expect(filterByPlaceType(candidates, { drinker: 2, ok: 0, uncomfortable: 0 })).toHaveLength(
      candidates.length,
    );
  });

  it('ok 포함 → drink_required 제외', () => {
    const result = filterByPlaceType(candidates, { drinker: 1, ok: 1, uncomfortable: 0 });
    const types = result.flatMap((c) => c.types);
    expect(types).not.toContain('bar');
    expect(types).not.toContain('wine_bar');
    expect(types).toContain('barbecue_restaurant');
  });

  it('등록 override 반영', () => {
    const owner: Candidate = cand([], {
      source: 'owner',
      placeTypeOverride: 'drink_required' as PlaceType,
    });
    expect(filterByPlaceType([owner], { drinker: 1, ok: 1, uncomfortable: 0 })).toHaveLength(0);
    expect(filterByPlaceType([owner], { drinker: 1, ok: 0, uncomfortable: 0 })).toHaveLength(1);
  });
});
