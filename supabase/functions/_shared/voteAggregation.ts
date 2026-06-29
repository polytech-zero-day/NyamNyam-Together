import type { AggregatedConstraints, MoodPref } from './domain/types.ts';
import type { DrinkValue, MoodValue } from './database.types.ts';
import type { SortMode } from './domain/sort.ts';

export interface Stage1Vote {
  drink: DrinkValue;
  budget_min: number | null;
  budget_max: number | null;
  categories: string[];
  mood: MoodValue | null;
  sort_pref: SortMode | null;
}

// 참여자들이 stage1에서 고른 정렬 기준을 다수결로 집계. 동점/무응답이면 기본값(review_count).
export function tallySortMode(votes: Stage1Vote[]): SortMode {
  const counts: Record<SortMode, number> = { review_count: 0, rating: 0, random: 0 };
  for (const v of votes) {
    if (v.sort_pref) counts[v.sort_pref] += 1;
  }
  const ranked = (Object.keys(counts) as SortMode[]).sort((a, b) => counts[b] - counts[a]);
  // 1등이 0표(아무도 안 고름)이거나 2등과 동점이면 기본값.
  if (counts[ranked[0]] === 0) return 'review_count';
  if (counts[ranked[0]] === counts[ranked[1]]) return 'review_count';
  return ranked[0];
}

function percentile(sorted: number[], p: number, fallback: number): number {
  if (sorted.length === 0) return fallback;
  // 인덱스가 배열 범위를 벗어나지 않도록 clamp
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx];
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
