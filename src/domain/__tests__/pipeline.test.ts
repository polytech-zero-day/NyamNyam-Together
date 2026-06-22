import { runPipeline, RestaurantRow, Stage1Response } from '../pipeline';

// restaurants 마스터 행 생성. opts로 웹서치 컬럼(avg_price_min, mood, source_rating 등) 덮어쓰기.
const mkPlace = (
  id: string,
  name: string,
  category_name: string,
  opts: Partial<RestaurantRow> = {},
): RestaurantRow => {
  const parts = category_name.split(' > ').map((s) => s.trim());
  return {
    id,
    kakao_id: id,
    station_id: 'gangnam',
    name,
    category_large: parts[0] ?? category_name,
    category_mid: parts[1] ?? null,
    category_small: parts[2] ?? null,
    category_name,
    address: '서울시 강남구',
    road_address: null,
    phone: null,
    lat: 37.5,
    lng: 127.0,
    distance_m: 300,
    kakao_url: `http://place.map.kakao.com/${id}`,
    price_level: null,
    avg_price_min: null,
    avg_price_max: null,
    mood: null,
    source: null,
    source_rating: null,
    source_url: null,
    crawled_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...opts,
  };
};

const mkResponse = (
  drink: Stage1Response['drink'],
  budget_max: number,
  categories: string[],
  mood: Stage1Response['mood'] = null,
): Stage1Response => ({ drink, budget_min: 0, budget_max, categories, mood });

describe('runPipeline — 빈 입력', () => {
  it('places 없음 → 빈 결과', () => {
    expect(runPipeline([], [mkResponse('ok', 20_000, ['한식'])])).toEqual({
      recommended: [],
      relaxedConstraints: [],
    });
  });

  it('responses 없음 → 빈 결과', () => {
    expect(runPipeline([mkPlace('1', '한식당', '음식점 > 한식')], [])).toEqual({
      recommended: [],
      relaxedConstraints: [],
    });
  });
});

describe('runPipeline — 정상 케이스', () => {
  it('relaxedConstraints 없음, 최대 10개 반환', () => {
    const places = Array.from({ length: 15 }, (_, i) =>
      mkPlace(String(i), `식당${i}`, '음식점 > 한식'),
    );
    const responses = [mkResponse('ok', 30_000, ['한식']), mkResponse('ok', 30_000, ['한식'])];
    const result = runPipeline(places, responses);
    expect(result.relaxedConstraints).toEqual([]);
    expect(result.recommended.length).toBeLessThanOrEqual(10);
    expect(result.recommended.every((p) => !p.relaxed)).toBe(true);
  });

  it('rank: 1부터 시작, 오름차순', () => {
    const places = [mkPlace('1', '한식', '음식점 > 한식'), mkPlace('2', '일식', '음식점 > 일식')];
    const responses = [mkResponse('ok', 30_000, ['한식']), mkResponse('ok', 30_000, ['한식'])];
    const result = runPipeline(places, responses);
    expect(result.recommended[0].rank).toBe(1);
    expect(result.recommended[result.recommended.length - 1].rank).toBe(result.recommended.length);
  });

  it('카테고리 2표 매칭 장소가 앞에 위치', () => {
    const places = [
      mkPlace('1', '중식당', '음식점 > 중식'),
      mkPlace('2', '한식당', '음식점 > 한식'),
    ];
    const responses = [mkResponse('ok', 30_000, ['한식']), mkResponse('ok', 30_000, ['한식'])];
    const result = runPipeline(places, responses);
    expect(result.recommended[0].id).toBe('2'); // 한식이 앞
  });

  it('place_type이 classifyPlaceType 결과로 채워짐', () => {
    const places = [mkPlace('1', '카페', '카페'), mkPlace('2', '이자카야', '주점 > 이자카야')];
    const responses = [mkResponse('drinker', 30_000, [])];
    const result = runPipeline(places, responses);
    const cafe = result.recommended.find((p) => p.id === '1');
    const izakaya = result.recommended.find((p) => p.id === '2');
    expect(cafe?.place_type).toBe('general');
    expect(izakaya?.place_type).toBe('compatible');
  });
});

describe('runPipeline — 술 제약 (끝까지 유지)', () => {
  it('uncomfortable 있으면 주점 전부 제외', () => {
    const places = [
      mkPlace('1', '한식당', '음식점 > 한식'),
      mkPlace('2', '이자카야', '주점 > 이자카야'),
      mkPlace('3', '바', '주점 > 바'),
    ];
    const responses = [mkResponse('uncomfortable', 30_000, []), mkResponse('ok', 30_000, [])];
    const result = runPipeline(places, responses);
    const ids = result.recommended.map((p) => p.id);
    expect(ids).toContain('1');
    expect(ids).not.toContain('2');
    expect(ids).not.toContain('3');
  });

  it('ok만: drink_required(바) 제외, compatible(이자카야) 포함', () => {
    const places = [
      mkPlace('1', '한식당', '음식점 > 한식'),
      mkPlace('2', '이자카야', '주점 > 이자카야'),
      mkPlace('3', '칵테일바', '주점 > 칵테일바'),
    ];
    const responses = [mkResponse('ok', 30_000, []), mkResponse('ok', 30_000, [])];
    const result = runPipeline(places, responses);
    const ids = result.recommended.map((p) => p.id);
    expect(ids).toContain('1');
    expect(ids).toContain('2');
    expect(ids).not.toContain('3');
  });
});

describe('runPipeline — 완화 로직', () => {
  it('완화1: 예산 필터로 0개 → 예산 완화 + relaxed=true', () => {
    // avg_price_min 12000 > 상한 5000 → 예산 필터로 0개 → 예산 완화
    const places = [mkPlace('1', '한식', '음식점 > 한식', { avg_price_min: 12_000 })];
    const responses = [mkResponse('ok', 5_000, ['한식']), mkResponse('ok', 5_000, ['한식'])];
    const result = runPipeline(places, responses);
    expect(result.relaxedConstraints).toEqual(['budget']);
    expect(result.recommended).toHaveLength(1);
    expect(result.recommended[0].relaxed).toBe(true);
  });

  it('완화1에서도 술 제약은 유지됨', () => {
    const places = [
      mkPlace('1', '한식당', '음식점 > 한식', { avg_price_min: 12_000 }),
      mkPlace('2', '바', '주점 > 바', { avg_price_min: 12_000 }),
    ];
    const responses = [mkResponse('uncomfortable', 5_000, [])];
    const result = runPipeline(places, responses);
    expect(result.relaxedConstraints).toContain('budget');
    const ids = result.recommended.map((p) => p.id);
    expect(ids).toContain('1');
    expect(ids).not.toContain('2'); // 바는 술 제약으로 여전히 제외
  });

  it('완화3: 술 제약 후 장소 없음 → radius 플래그', () => {
    // uncomfortable인데 주점만 있는 경우
    const places = [mkPlace('1', '바', '주점 > 바')];
    const responses = [mkResponse('uncomfortable', 30_000, [])];
    const result = runPipeline(places, responses);
    expect(result.recommended).toHaveLength(0);
    expect(result.relaxedConstraints).toContain('radius');
  });
});

describe('runPipeline — 분위기 가중치', () => {
  it('quiet 다수 시 카페가 동점 일반 식당보다 앞에 위치', () => {
    const places = [
      mkPlace('1', '식당', '음식점 > 한식'),
      mkPlace('2', '카페', '카페', { mood: ['조용한'] }), // 웹서치 확인 mood 배열
    ];
    const responses = [
      mkResponse('ok', 30_000, [], 'quiet'),
      mkResponse('ok', 30_000, [], 'quiet'),
    ];
    const result = runPipeline(places, responses);
    // 카테고리 동점(0점씩), 카페는 mood '조용한' 2점 보너스 → 카페 앞
    expect(result.recommended[0].id).toBe('2');
  });
});
