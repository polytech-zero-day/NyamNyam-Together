// 예산 보수적 컷 (domain-rules.md 2장)
// 우선순위: restaurants.avg_price_min (DB 웹서치 확인값) → 둘 다 null이면 category_name 추정 보조.
// 집계: 상한값 중 낮은 쪽 강하게. 완전 최솟값은 0개 위험 → P25 완충.

// [category_name 접두어, 추정 1인당 가격(원)] — 긴 접두어부터 매칭
const CATEGORY_PRICE_ESTIMATES: Array<[string, number]> = [
  ['음식점 > 뷔페',             35_000],
  ['음식점 > 양식 > 스테이크',  30_000],
  ['음식점 > 일식 > 스시',      25_000],
  ['음식점 > 양식',             20_000],
  ['음식점 > 일식',             18_000],
  ['음식점 > 한식 > 육류,고기', 15_000],
  ['음식점 > 치킨',             15_000],
  ['음식점 > 한식',             12_000],
  ['음식점 > 중식',             12_000],
  ['음식점 > 패스트푸드',        8_000],
  ['음식점 > 분식',              7_000],
  ['음식점',                    12_000],
  ['카페,디저트',                7_000],
  ['카페',                       7_000],
  ['주점 > 이자카야',           20_000],
  ['주점',                      20_000],
];

const DEFAULT_PRICE_ESTIMATE = 15_000;

// 추정 불확실성 완충: 카카오 가격 정보 미제공으로 인한 오차 허용 범위
const ESTIMATION_BUFFER = 1.2;

export function estimatePricePerPerson(categoryName: string): number {
  for (const [prefix, price] of CATEGORY_PRICE_ESTIMATES) {
    if (categoryName.startsWith(prefix)) return price;
  }
  return DEFAULT_PRICE_ESTIMATE;
}

/**
 * budget_max 배열에서 P25(하위 25%)를 상한으로 사용.
 * 완전 최솟값 대신 P25를 써서 "후보 0개" 위험을 줄임 (완충).
 */
export function computeBudgetCap(budgetMaxValues: number[]): number {
  if (budgetMaxValues.length === 0) return Infinity;
  const sorted = [...budgetMaxValues].sort((a, b) => a - b);
  const p25Index = Math.floor(sorted.length * 0.25);
  return sorted[p25Index];
}

/**
 * 예산 필터.
 * - avg_price_min이 있으면 DB 확인값 우선 사용.
 * - avg_price_min이 null이면 avg_price_max를 시도.
 * - 둘 다 null이면 category_name 기반 추정으로 폴백 (domain-rules.md 경고: 보조 수단).
 * - avg_price_min이 null인 식당 → 예산 필터 미적용, Claude 판단에 위임 (통과시킴).
 */
export function filterByBudget<
  T extends { avg_price_min: number | null; avg_price_max: number | null; category_name: string },
>(places: T[], budgetCap: number): T[] {
  return places.filter((p) => {
    if (p.avg_price_min !== null) {
      // DB 확인값: avg_price_min이 예산 상한 이하인지
      return p.avg_price_min <= budgetCap;
    }
    if (p.avg_price_max !== null) {
      // avg_price_max만 있는 경우: 최대가가 예산 상한 이하인지
      return p.avg_price_max <= budgetCap;
    }
    // 둘 다 null → Claude 판단에 위임 (필터 미적용, 통과)
    return true;
  });
}

/**
 * category_name 추정 기반 예산 필터 (fallback용).
 * avg_price_min/max가 null인 식당에만 적용할 때 사용.
 */
export function filterByBudgetEstimate<T extends { category_name: string }>(
  places: T[],
  budgetCap: number,
): T[] {
  return places.filter(
    (p) => estimatePricePerPerson(p.category_name) <= budgetCap * ESTIMATION_BUFFER,
  );
}
