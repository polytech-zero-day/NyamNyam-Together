// stage1 votes → AggregatedConstraints 집계
// 집계 규칙: 술 분포 보존, 예산 max는 P25 보수 컷, min은 최솟값, 카테고리 표수 그대로.
// 2표 임계·매핑은 C(domain/)가 적용 — 여기선 표수만 집계한다.

import type { AggregatedConstraints, MoodPref } from '../domain/types';
import type { DrinkValue, MoodValue } from '../types/database.types';

export interface Stage1Vote {
  drink: DrinkValue;
  budget_min: number | null;
  budget_max: number | null;
  categories: string[];
  mood: MoodValue | null;
}

function percentile(sorted: number[], p: number, fallback: number): number {
  if (sorted.length === 0) return fallback;
  return sorted[Math.floor(sorted.length * p)];
}

export function buildConstraintsFromVotes(votes: Stage1Vote[]): AggregatedConstraints {
  const drink = { drinker: 0, ok: 0, uncomfortable: 0 };
  for (const v of votes) drink[v.drink] += 1;

  const maxes = votes
    .map((v) => v.budget_max)
    .filter((x): x is number => typeof x === 'number')
    .sort((a, b) => a - b);
  const mins = votes
    .map((v) => v.budget_min)
    .filter((x): x is number => typeof x === 'number')
    .sort((a, b) => a - b);

  // budgetMax: P25 보수 컷 (상한이 낮은 사람 기준으로 좁힘). budgetMin: 소프트 → 최솟값
  const budgetMax = percentile(maxes, 0.25, Number.POSITIVE_INFINITY);
  const budgetMin = mins.length ? mins[0] : 0;

  const counts = new Map<string, number>();
  for (const v of votes) {
    for (const c of v.categories) {
      if (c.trim()) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const categories = [...counts.entries()].map(([name, n]) => ({ name, votes: n }));

  const moods = votes
    .map((v) => v.mood)
    .filter((m): m is MoodValue => m === 'quiet' || m === 'any');
  let moodDominant: MoodPref | null = null;
  if (moods.length > 0) {
    const quietRatio = moods.filter((m) => m === 'quiet').length / moods.length;
    moodDominant = quietRatio > 0.5 ? 'quiet' : 'any';
  }

  return { drink, budgetMin, budgetMax, categories, moodDominant };
}
