// 예산 (domain-rules.md §2) — 범위 입력, max 주력 필터·min 소프트
// 구글은 priceLevel(1~4)만 제공 → 금액을 밴드로 환산. priceLevel null이면 통과.
// ⚠️ 원본 budget_max 배열의 P25 종합은 B 소유 → 여기서 하지 않는다(budgetMax는 집계값 입력).

import type { Candidate } from './types';

// 금액(원) → priceLevel 밴드 (domain-rules.md §2 표)
// TODO(데이터): 한국 priceLevel 분포 확인 후 경계 보정. priceRange(원 단위) 도입 시 정밀화.
const BAND_BOUNDARIES: Array<[max: number, band: number]> = [
  [12_000, 1],
  [25_000, 2],
  [50_000, 3],
];
const TOP_BAND = 4;

export function bandOf(won: number): number {
  for (const [max, band] of BAND_BOUNDARIES) {
    if (won < max) return band;
  }
  return TOP_BAND;
}

/**
 * 예산 상한 필터 (주력).
 * - priceLevel ≤ bandOf(budgetMax) 통과.
 * - priceLevel null → 예산 필터 미적용(통과).
 */
export function filterByBudgetMax(candidates: Candidate[], budgetMax: number): Candidate[] {
  const cap = bandOf(budgetMax);
  return candidates.filter((c) => c.priceLevel === null || c.priceLevel <= cap);
}

// min 소프트 감점 (domain-rules.md §2): 하한 밴드 미만은 정렬에서 약하게 후순위.
// 하드 필터 아님. priceLevel null이면 0(감점 없음).
const BUDGET_MIN_PENALTY = 5;

export function budgetMinPenalty(priceLevel: number | null, budgetMin: number): number {
  if (priceLevel === null) return 0;
  return priceLevel < bandOf(budgetMin) ? BUDGET_MIN_PENALTY : 0;
}
