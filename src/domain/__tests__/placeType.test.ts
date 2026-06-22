import { classifyPlaceType, allowedPlaceTypes, filterByPlaceType, DrinkPref } from '../placeType';

const place = (category_name: string) => ({ category_name });

describe('classifyPlaceType', () => {
  it('drink_required: 칵테일바, 와인바, LP바, 바, 펍', () => {
    expect(classifyPlaceType('주점 > 칵테일바')).toBe('drink_required');
    expect(classifyPlaceType('주점 > 와인바')).toBe('drink_required');
    expect(classifyPlaceType('주점 > 바')).toBe('drink_required');
    expect(classifyPlaceType('주점 > 펍')).toBe('drink_required');
  });

  it('compatible: 이자카야, 호프, 포장마차, 고깃집, 곱창', () => {
    expect(classifyPlaceType('주점 > 이자카야')).toBe('compatible');
    expect(classifyPlaceType('주점 > 호프,통닭')).toBe('compatible');
    expect(classifyPlaceType('주점 > 포장마차')).toBe('compatible');
    expect(classifyPlaceType('음식점 > 한식 > 육류,고기')).toBe('compatible');
    expect(classifyPlaceType('음식점 > 한식 > 곱창,막창')).toBe('compatible');
  });

  it('기타 주점 → compatible (폴백)', () => {
    expect(classifyPlaceType('주점 > 기타')).toBe('compatible');
    expect(classifyPlaceType('주점')).toBe('compatible');
  });

  it('general: 일반 음식점·카페', () => {
    expect(classifyPlaceType('음식점 > 한식')).toBe('general');
    expect(classifyPlaceType('음식점 > 일식')).toBe('general');
    expect(classifyPlaceType('카페')).toBe('general');
    expect(classifyPlaceType('카페,디저트')).toBe('general');
  });

  it('알 수 없는 카테고리 → general 기본값', () => {
    expect(classifyPlaceType('')).toBe('general');
    expect(classifyPlaceType('기타')).toBe('general');
  });

  it('긴 접두어 우선 매칭', () => {
    // "주점 > 이자카야"는 "주점 > 바" 보다 앞에 있어 compatible 반환
    expect(classifyPlaceType('주점 > 이자카야 > 일식주점')).toBe('compatible');
  });
});

describe('allowedPlaceTypes', () => {
  it('③(uncomfortable) 1명이라도 → general만', () => {
    expect(allowedPlaceTypes(['uncomfortable'])).toEqual(new Set(['general']));
    expect(allowedPlaceTypes(['drinker', 'ok', 'uncomfortable'])).toEqual(new Set(['general']));
  });

  it('전원 ①(drinker) + ③없음 → 전부 (drink_required 포함)', () => {
    expect(allowedPlaceTypes(['drinker'])).toEqual(
      new Set(['drink_required', 'compatible', 'general']),
    );
    expect(allowedPlaceTypes(['drinker', 'drinker'])).toEqual(
      new Set(['drink_required', 'compatible', 'general']),
    );
  });

  it('①+② 혼재 → compatible + general (drink_required 제외)', () => {
    expect(allowedPlaceTypes(['drinker', 'ok'])).toEqual(new Set(['compatible', 'general']));
    expect(allowedPlaceTypes(['ok', 'drinker', 'drinker'])).toEqual(
      new Set(['compatible', 'general']),
    );
  });

  it('②(ok)만 → compatible + general', () => {
    expect(allowedPlaceTypes(['ok'])).toEqual(new Set(['compatible', 'general']));
    expect(allowedPlaceTypes(['ok', 'ok'])).toEqual(new Set(['compatible', 'general']));
  });
});

describe('filterByPlaceType', () => {
  const places = [
    place('음식점 > 한식'),
    place('음식점 > 일식'),
    place('카페'),
    place('주점 > 이자카야'), // compatible
    place('주점 > 호프,통닭'), // compatible
    place('주점 > 바'), // drink_required
    place('주점 > 칵테일바'), // drink_required
  ];

  it('uncomfortable: 음식점·카페만', () => {
    const result = filterByPlaceType(places, ['uncomfortable']);
    expect(result).toHaveLength(3);
    expect(
      result.every(
        (p) => p.category_name.startsWith('음식점') || p.category_name.startsWith('카페'),
      ),
    ).toBe(true);
  });

  it('전원 drinker: 전부', () => {
    expect(filterByPlaceType(places, ['drinker'])).toHaveLength(places.length);
  });

  it('drinker+ok 혼재: drink_required 제외', () => {
    const result = filterByPlaceType(places, ['drinker', 'ok']);
    expect(result.map((p) => p.category_name)).not.toContain('주점 > 바');
    expect(result.map((p) => p.category_name)).not.toContain('주점 > 칵테일바');
    expect(result.map((p) => p.category_name)).toContain('주점 > 이자카야');
  });

  it('ok: drink_required 제외', () => {
    const result = filterByPlaceType(places, ['ok']);
    expect(result.map((p) => p.category_name)).not.toContain('주점 > 바');
    expect(result.map((p) => p.category_name)).not.toContain('주점 > 칵테일바');
    expect(result.map((p) => p.category_name)).toContain('주점 > 이자카야');
  });

  it('혼재(drinker+ok+uncomfortable) → uncomfortable 우선: general만', () => {
    const prefs: DrinkPref[] = ['drinker', 'ok', 'uncomfortable'];
    const result = filterByPlaceType(places, prefs);
    expect(result.every((p) => !p.category_name.startsWith('주점'))).toBe(true);
  });

  it('빈 입력', () => {
    expect(filterByPlaceType([], ['ok'])).toEqual([]);
  });
});
