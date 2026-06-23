import { runPipeline } from '../pipeline';
import type { AggregatedConstraints, Candidate } from '../types';

const asOf = new Date('2026-06-23T00:00:00Z');

const cand = (ref: string, types: string[], overrides: Partial<Candidate> = {}): Candidate => ({
  ref,
  placeId: ref,
  source: 'google',
  types,
  primaryType: types[0] ?? null,
  priceLevel: null,
  rating: null,
  userRatingCount: null,
  name: ref,
  distanceM: 300,
  placeTypeOverride: null,
  categoryKorean: null,
  openDate: null,
  ...overrides,
});

const constraints = (overrides: Partial<AggregatedConstraints> = {}): AggregatedConstraints => ({
  drink: { drinker: 0, ok: 2, uncomfortable: 0 },
  budgetMin: 0,
  budgetMax: 30_000,
  categories: [],
  moodDominant: null,
  ...overrides,
});

describe('runPipeline — 빈 입력', () => {
  it('candidates 없음 → 빈 결과', () => {
    expect(
      runPipeline([], constraints({ categories: [{ name: '한식', votes: 2 }] }), asOf),
    ).toEqual({
      recommended: [],
      relaxedConstraints: [],
    });
  });
});

describe('runPipeline — 정상 케이스', () => {
  it('relaxed 없음, 최대 10개', () => {
    const candidates = Array.from({ length: 15 }, (_, i) => cand(String(i), ['korean_restaurant']));
    const result = runPipeline(candidates, constraints(), asOf);
    expect(result.relaxedConstraints).toEqual([]);
    expect(result.recommended.length).toBeLessThanOrEqual(10);
    expect(result.recommended.every((c) => !c.relaxed)).toBe(true);
  });

  it('rank 1부터 오름차순', () => {
    const candidates = [cand('1', ['korean_restaurant']), cand('2', ['japanese_restaurant'])];
    const result = runPipeline(candidates, constraints(), asOf);
    expect(result.recommended[0].rank).toBe(1);
    expect(result.recommended.at(-1)?.rank).toBe(result.recommended.length);
  });

  it('카테고리 2표 매칭 후보가 앞', () => {
    const candidates = [cand('1', ['chinese_restaurant']), cand('2', ['korean_restaurant'])];
    const result = runPipeline(
      candidates,
      constraints({ categories: [{ name: '한식', votes: 2 }] }),
      asOf,
    );
    expect(result.recommended[0].ref).toBe('2');
  });

  it('placeType 스냅샷 채워짐', () => {
    const candidates = [cand('1', ['cafe']), cand('2', ['barbecue_restaurant'])];
    const result = runPipeline(
      candidates,
      constraints({ drink: { drinker: 2, ok: 0, uncomfortable: 0 } }),
      asOf,
    );
    expect(result.recommended.find((c) => c.ref === '1')?.placeType).toBe('general');
    expect(result.recommended.find((c) => c.ref === '2')?.placeType).toBe('compatible');
  });

  it('리뷰 수 스냅샷 + 동점 시 리뷰 수 정렬', () => {
    const candidates = [
      cand('1', ['korean_restaurant'], { userRatingCount: 10, rating: 4.0 }),
      cand('2', ['korean_restaurant'], { userRatingCount: 200, rating: 4.5 }),
    ];
    const result = runPipeline(candidates, constraints(), asOf);
    expect(result.recommended[0].ref).toBe('2');
    expect(result.recommended[0].reviewCountAtAgg).toBe(200);
    expect(result.recommended[0].ratingAtAgg).toBe(4.5);
  });
});

describe('runPipeline — 술 제약 (끝까지 유지)', () => {
  it('uncomfortable 있으면 주점 전부 제외', () => {
    const candidates = [
      cand('1', ['korean_restaurant']),
      cand('2', ['barbecue_restaurant']),
      cand('3', ['bar']),
    ];
    const result = runPipeline(
      candidates,
      constraints({ drink: { drinker: 1, ok: 1, uncomfortable: 1 } }),
      asOf,
    );
    const refs = result.recommended.map((c) => c.ref);
    expect(refs).toEqual(['1']);
  });

  it('ok 포함: drink_required(bar) 제외, compatible 포함', () => {
    const candidates = [
      cand('1', ['korean_restaurant']),
      cand('2', ['barbecue_restaurant']),
      cand('3', ['bar']),
    ];
    const result = runPipeline(
      candidates,
      constraints({ drink: { drinker: 1, ok: 1, uncomfortable: 0 } }),
      asOf,
    );
    const refs = result.recommended.map((c) => c.ref);
    expect(refs).toContain('1');
    expect(refs).toContain('2');
    expect(refs).not.toContain('3');
  });
});

describe('runPipeline — 예산 필터 + 완화', () => {
  it('priceLevel null은 예산 필터 통과', () => {
    const candidates = [cand('1', ['korean_restaurant'], { priceLevel: null })];
    const result = runPipeline(candidates, constraints({ budgetMax: 5_000 }), asOf);
    expect(result.recommended).toHaveLength(1);
    expect(result.relaxedConstraints).toEqual([]);
  });

  it('완화1: 예산으로 0개 → budget 완화 + relaxed=true', () => {
    // budgetMax 5_000 → band 1. priceLevel 3은 탈락 → 완화
    const candidates = [cand('1', ['korean_restaurant'], { priceLevel: 3 })];
    const result = runPipeline(candidates, constraints({ budgetMax: 5_000 }), asOf);
    expect(result.relaxedConstraints).toEqual(['budget']);
    expect(result.recommended).toHaveLength(1);
    expect(result.recommended[0].relaxed).toBe(true);
  });

  it('완화1에서도 술 제약 유지', () => {
    const candidates = [
      cand('1', ['korean_restaurant'], { priceLevel: 4 }),
      cand('2', ['bar'], { priceLevel: 4 }),
    ];
    const result = runPipeline(
      candidates,
      constraints({ budgetMax: 5_000, drink: { drinker: 0, ok: 0, uncomfortable: 1 } }),
      asOf,
    );
    expect(result.relaxedConstraints).toContain('budget');
    expect(result.recommended.map((c) => c.ref)).toEqual(['1']);
  });

  it('완화3: 술 제약 후 0개 → radius 플래그', () => {
    const candidates = [cand('1', ['bar'])];
    const result = runPipeline(
      candidates,
      constraints({ drink: { drinker: 0, ok: 0, uncomfortable: 1 } }),
      asOf,
    );
    expect(result.recommended).toHaveLength(0);
    expect(result.relaxedConstraints).toContain('radius');
  });
});

describe('runPipeline — longevity (등록 식당)', () => {
  it('동점일 때 오래된 등록 식당이 앞', () => {
    const candidates = [
      cand('g', ['korean_restaurant'], { source: 'google', userRatingCount: 5 }),
      cand('o', [], {
        source: 'owner',
        categoryKorean: '한식',
        placeTypeOverride: 'general',
        openDate: '2000-01-01',
        userRatingCount: 5,
      }),
    ];
    const result = runPipeline(
      candidates,
      constraints({ categories: [{ name: '한식', votes: 2 }] }),
      asOf,
    );
    // 둘 다 한식 매칭(10점), owner는 longevity +3 → owner 앞
    expect(result.recommended[0].ref).toBe('o');
  });
});

describe('runPipeline — min 소프트 감점', () => {
  it('하한 미만 밴드는 후순위(동일 카테고리)', () => {
    const candidates = [
      cand('cheap', ['korean_restaurant'], { priceLevel: 1, userRatingCount: 100 }),
      cand('mid', ['korean_restaurant'], { priceLevel: 3, userRatingCount: 100 }),
    ];
    // budgetMin 25_000 → band 3. cheap(1)은 감점 → mid 앞
    const result = runPipeline(
      candidates,
      constraints({ budgetMin: 25_000, budgetMax: 50_000 }),
      asOf,
    );
    expect(result.recommended[0].ref).toBe('mid');
  });
});
