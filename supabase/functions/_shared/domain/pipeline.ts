import type { AggregatedConstraints, Candidate, RankedCandidate } from './types.ts';
import { placeTypeOf, filterByPlaceType } from './placeType.ts';
import { filterByBudgetMax, budgetMinPenalty } from './budget.ts';
import { getEligibleCategories, scoreByCategoryMatch, googleTypesForCategory } from './category.ts';
import { computeMoodScore } from './mood.ts';
import { longevityScore } from './longevity.ts';

export type RelaxedConstraint = 'budget' | 'category' | 'radius';

export interface PipelineResult {
  recommended: RankedCandidate[];
  relaxedConstraints: RelaxedConstraint[];
}

const STORE_COUNT = 10;

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
    computeMoodScore(effectiveTypes(c), moodDominant) -
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
      const scoreDiff = scoreOf(b) - scoreOf(a);
      if (scoreDiff !== 0) return scoreDiff;
      const aReviews = a.userRatingCount ?? -1;
      const bReviews = b.userRatingCount ?? -1;
      if (aReviews !== bReviews) return bReviews - aReviews;
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

export function runPipeline(
  candidates: Candidate[],
  constraints: AggregatedConstraints,
  asOf: Date = new Date(),
): PipelineResult {
  if (candidates.length === 0) {
    return { recommended: [], relaxedConstraints: [] };
  }

  const eligibleCategories = getEligibleCategories(constraints.categories);

  const typeFiltered = filterByPlaceType(candidates, constraints.drink);
  const budgetFiltered = filterByBudgetMax(typeFiltered, constraints.budgetMax);

  if (budgetFiltered.length > 0) {
    return {
      recommended: rankCandidates(budgetFiltered, constraints, eligibleCategories, false, asOf),
      relaxedConstraints: [],
    };
  }

  if (typeFiltered.length > 0) {
    return {
      recommended: rankCandidates(typeFiltered, constraints, eligibleCategories, true, asOf),
      relaxedConstraints: ['budget'],
    };
  }

  return { recommended: [], relaxedConstraints: ['budget', 'category', 'radius'] };
}
