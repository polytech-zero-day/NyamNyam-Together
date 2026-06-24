import type { Candidate } from './types.ts';

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

export function filterByBudgetMax(candidates: Candidate[], budgetMax: number): Candidate[] {
  const cap = bandOf(budgetMax);
  return candidates.filter((c) => c.priceLevel === null || c.priceLevel <= cap);
}

const BUDGET_MIN_PENALTY = 5;

export function budgetMinPenalty(priceLevel: number | null, budgetMin: number): number {
  if (priceLevel === null) return 0;
  return priceLevel < bandOf(budgetMin) ? BUDGET_MIN_PENALTY : 0;
}
