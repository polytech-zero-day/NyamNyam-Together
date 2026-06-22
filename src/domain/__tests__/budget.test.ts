import {
  computeBudgetCap,
  estimatePricePerPerson,
  filterByBudget,
  filterByBudgetEstimate,
} from '../budget';

// filterByBudget 입력: DB restaurants 행 일부 (avg_price 웹서치 확인값)
const dbPlace = (
  category_name: string,
  avg_price_min: number | null,
  avg_price_max: number | null = null,
) => ({ category_name, avg_price_min, avg_price_max });

describe('estimatePricePerPerson', () => {
  it('정확히 매핑된 카테고리', () => {
    expect(estimatePricePerPerson('음식점 > 뷔페')).toBe(35_000);
    expect(estimatePricePerPerson('음식점 > 양식 > 스테이크,립')).toBe(30_000);
    expect(estimatePricePerPerson('음식점 > 일식 > 스시')).toBe(25_000);
    expect(estimatePricePerPerson('음식점 > 한식')).toBe(12_000);
    expect(estimatePricePerPerson('음식점 > 분식')).toBe(7_000);
    expect(estimatePricePerPerson('카페')).toBe(7_000);
    expect(estimatePricePerPerson('주점 > 이자카야')).toBe(20_000);
  });

  it('긴 접두어 우선: "음식점 > 양식 > 스테이크" > "음식점 > 양식"', () => {
    expect(estimatePricePerPerson('음식점 > 양식 > 스테이크,립')).toBe(30_000);
    expect(estimatePricePerPerson('음식점 > 양식')).toBe(20_000);
  });

  it('알 수 없는 카테고리 → 기본값 15000', () => {
    expect(estimatePricePerPerson('기타')).toBe(15_000);
    expect(estimatePricePerPerson('')).toBe(15_000);
  });
});

describe('computeBudgetCap — P25 완충', () => {
  it('1명 → 그 값 그대로', () => {
    expect(computeBudgetCap([20_000])).toBe(20_000);
  });

  it('빈 배열 → Infinity', () => {
    expect(computeBudgetCap([])).toBe(Infinity);
  });

  it('2명 → 최솟값 (P25 = index 0)', () => {
    expect(computeBudgetCap([30_000, 20_000])).toBe(20_000);
  });

  it('4명 → P25(index 1)이 최솟값과 다를 수 있음', () => {
    // sorted: [10000, 20000, 30000, 40000]
    // floor(4 * 0.25) = 1 → 20000 (최솟값 10000보다 높음)
    const cap = computeBudgetCap([40_000, 10_000, 30_000, 20_000]);
    expect(cap).toBe(20_000);
    expect(cap).toBeGreaterThan(10_000); // 완전 최솟값보다 높음 = 완충 동작 확인
  });

  it('완충: 완전 최솟값보다 높거나 같음 (3명 이하에선 동일 가능)', () => {
    const budgets = [15_000, 25_000, 35_000, 45_000, 55_000];
    const cap = computeBudgetCap(budgets);
    expect(cap).toBeGreaterThanOrEqual(Math.min(...budgets));
  });
});

// filterByBudget는 DB 웹서치 확인값(avg_price_min/max) 기준 필터 (domain-rules.md 2)
describe('filterByBudget — DB avg_price 확인값 기준', () => {
  it('avg_price_min ≤ 상한 → 통과 / 초과 → 제외', () => {
    const places = [
      dbPlace('음식점 > 분식', 7_000),
      dbPlace('주점 > 이자카야', 20_000),
      dbPlace('음식점 > 뷔페', 35_000),
    ];
    const result = filterByBudget(places, 20_000);
    expect(result.map((p) => p.category_name)).toContain('음식점 > 분식');
    expect(result.map((p) => p.category_name)).toContain('주점 > 이자카야'); // 경계값 20000 통과
    expect(result.map((p) => p.category_name)).not.toContain('음식점 > 뷔페');
  });

  it('avg_price_min이 null이면 avg_price_max로 판단', () => {
    const places = [
      dbPlace('음식점 > 한식', null, 18_000), // max ≤ 20000 → 통과
      dbPlace('음식점 > 양식', null, 30_000), // max > 20000 → 제외
    ];
    const result = filterByBudget(places, 20_000);
    expect(result.map((p) => p.category_name)).toContain('음식점 > 한식');
    expect(result.map((p) => p.category_name)).not.toContain('음식점 > 양식');
  });

  it('avg_price_min·max 둘 다 null → 필터 미적용(통과, Claude 판단 위임)', () => {
    const places = [dbPlace('음식점 > 한식', null, null)];
    expect(filterByBudget(places, 5_000)).toHaveLength(1);
  });

  it('상한 Infinity → 전부 통과', () => {
    const places = [dbPlace('음식점 > 분식', 7_000), dbPlace('음식점 > 뷔페', 35_000)];
    expect(filterByBudget(places, Infinity)).toHaveLength(2);
  });
});

// filterByBudgetEstimate는 avg_price가 둘 다 null일 때 category_name 추정 폴백 (domain-rules.md 2 경고)
describe('filterByBudgetEstimate — category_name 추정 폴백', () => {
  const estPlace = (category_name: string) => ({ category_name });
  const places = [
    estPlace('음식점 > 분식'),    // 7,000
    estPlace('주점 > 이자카야'),  // 20,000
    estPlace('음식점 > 뷔페'),    // 35,000
  ];

  it('상한 20000 → 추정가 > 상한×1.2(=24000) 제외 (뷔페만 제외)', () => {
    const result = filterByBudgetEstimate(places, 20_000);
    expect(result.map((p) => p.category_name)).not.toContain('음식점 > 뷔페');
    expect(result.map((p) => p.category_name)).toContain('주점 > 이자카야');
  });

  it('상한 5000 → 추정가 최소(7000) > 5000×1.2(=6000) → 전부 제외', () => {
    expect(filterByBudgetEstimate(places, 5_000)).toHaveLength(0);
  });
});
