// 2단 파이프라인 (domain-rules.md 전체)
// 입력 = "이미 집계된 제약"(AggregatedConstraints) + 후보 풀(구글 라이브 ∪ 등록 식당).
// 선정은 코드가 끝낸다(순수 함수). AI/LLM 개입 없음.

import type { AggregatedConstraints, Candidate, RankedCandidate } from './types';
import { placeTypeOf, filterByPlaceType } from './placeType';
import { filterByBudgetMax, budgetMinPenalty } from './budget';
import { getEligibleCategories, scoreByCategoryMatch, googleTypesForCategory } from './category';
import { computeMoodScore } from './mood';
import { longevityScore } from './longevity';

export type RelaxedConstraint = 'budget' | 'category' | 'radius';

export interface PipelineResult {
  recommended: RankedCandidate[];
  relaxedConstraints: RelaxedConstraint[];
}

// DB엔 최대 STORE_COUNT까지 저장; 화면엔 상위 3~4만 노출(라우트 정렬).
const STORE_COUNT = 10;

// 등록 식당은 한글 분류를 google types로 환산해 카테고리 매칭에 참여시킨다.
function effectiveTypes(c: Candidate): string[] {
  if (c.categoryKorean) {
    return [...c.types, ...googleTypesForCategory(c.categoryKorean)];
  }
  return c.types;
}

function scoreCandidate(
  c: Candidate,
  eligibleCategories: string[],
  moodDominant: AggregatedConstraints['moodDominant'],
  budgetMin: number,
  asOf: Date,
): number {
  return (
    scoreByCategoryMatch(effectiveTypes(c), eligibleCategories) +
    longevityScore(c.openDate, asOf) +
    computeMoodScore(moodDominant) -
    budgetMinPenalty(c.priceLevel, budgetMin)
  );
}

function rankCandidates(
  candidates: Candidate[],
  constraints: AggregatedConstraints,
  eligibleCategories: string[],
  relaxed: boolean,
  asOf: Date,
): RankedCandidate[] {
  const scoreOf = (c: Candidate): number =>
    scoreCandidate(c, eligibleCategories, constraints.moodDominant, constraints.budgetMin, asOf);

  return [...candidates]
    .sort((a, b) => {
      // 1순위: 선호형 복합 점수 (카테고리 + longevity − min소프트)
      const scoreDiff = scoreOf(b) - scoreOf(a);
      if (scoreDiff !== 0) return scoreDiff;

      // 2순위: 리뷰 수(userRatingCount) 내림차순, null 후순위
      const aReviews = a.userRatingCount ?? -1;
      const bReviews = b.userRatingCount ?? -1;
      if (aReviews !== bReviews) return bReviews - aReviews;

      // 3순위: 거리 오름차순
      return (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY);
    })
    .slice(0, STORE_COUNT)
    .map((c, idx) => ({
      ...c,
      placeType: placeTypeOf(c),
      score: scoreOf(c),
      rank: idx + 1,
      relaxed,
      reviewCountAtAgg: c.userRatingCount,
      ratingAtAgg: c.rating,
    }));
}

/**
 * 2단 파이프라인.
 * - Stage1 필터형: 술 분포(끝까지 유지) → 예산 상한.
 * - Stage2 선호형: 카테고리 2표 매칭 + longevity + min소프트 정렬.
 * - 완화 순서(domain-rules.md §7): 예산 → 카테고리 → 반경. 술 제약은 끝까지 유지.
 *
 * @param asOf longevity 기준 시각(테스트 결정성). 기본 현재.
 */
export function runPipeline(
  candidates: Candidate[],
  constraints: AggregatedConstraints,
  asOf: Date = new Date(),
): PipelineResult {
  if (candidates.length === 0) {
    return { recommended: [], relaxedConstraints: [] };
  }

  const eligibleCategories = getEligibleCategories(constraints.categories);

  // Stage1: 술 타입(완화 안 함) → 예산 상한
  const typeFiltered = filterByPlaceType(candidates, constraints.drink);
  const budgetFiltered = filterByBudgetMax(typeFiltered, constraints.budgetMax);

  // Stage2: 선호형 정렬
  if (budgetFiltered.length > 0) {
    return {
      recommended: rankCandidates(budgetFiltered, constraints, eligibleCategories, false, asOf),
      relaxedConstraints: [],
    };
  }

  // 완화1: 예산(min 하한 먼저 → 상한까지) — 술 제약 유지, typeFiltered 전체로 확장
  if (typeFiltered.length > 0) {
    return {
      recommended: rankCandidates(typeFiltered, constraints, eligibleCategories, true, asOf),
      relaxedConstraints: ['budget'],
    };
  }

  // 완화2·3: 술 제약 후 후보 0개 → 카테고리·반경. 반경 확대 재호출은 recommend 서비스가 수행.
  return { recommended: [], relaxedConstraints: ['budget', 'category', 'radius'] };
}
