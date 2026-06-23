// ⚠️ 잠정 절충안 (PROVISIONAL) — 신스택 B 집계: stage1 votes → AggregatedConstraints
// 원래 B 소유다. B 담당(K-yoon03 등) 합류 전까지 통합 브랜치(integ/backend-merge)가 실제 그룹
// 제약을 반영하도록 우리가 임시 구현한다. **합류 시 검토·교체 대상.** (integration-contract.md §3·§7)
// 집계 규칙은 단순·방어적: 분포 보존(술), 예산은 max 보수 컷·min 소프트, 카테고리는 표수 그대로.

import type { AggregatedConstraints, MoodPref } from '../domain/types';
import type { DrinkValue, MoodValue } from '../types/database.types';

export interface Stage1Vote {
  drink: DrinkValue;
  budget_min: number | null;
  budget_max: number | null;
  categories: string[];
  mood: MoodValue | null;
}

// 하위 p 분위수(정렬된 배열 기준). 빈 배열이면 fallback.
function percentile(sorted: number[], p: number, fallback: number): number {
  if (sorted.length === 0) return fallback;
  return sorted[Math.floor(sorted.length * p)];
}

/**
 * stage1 votes를 AggregatedConstraints로 집계 (잠정).
 * - drink: 분포(인원수) 보존 — 매핑은 C(domain/placeType)가 함
 * - budgetMax: 상한 주력 → P25 보수 컷(0개 위험 완화). budgetMin: 하한 소프트 → 최솟값
 * - categories: 한글 분류별 표수 그대로(2표 임계는 C가 적용)
 * - moodDominant: quiet 비율 > 0.5면 quiet, 아니면 any, 응답 없으면 null
 */
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
