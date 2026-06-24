import type { AggregatedConstraints, MoodPref } from './domain/types.ts';
import type { DrinkValue, MoodValue } from './database.types.ts';

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
