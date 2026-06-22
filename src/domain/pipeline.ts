// 2단 파이프라인 (domain-rules.md 전체)
// LLM에게 식당 선정을 위임하지 않는다. 모든 선정 로직은 순수 함수.

import { DrinkPref, PlaceType, classifyPlaceType, filterByPlaceType } from './placeType';
import { computeBudgetCap, filterByBudget } from './budget';
import { getEligibleCategories, scoreByCategoryMatch } from './category';
import { MoodPref, computeQuietRatio, computeMoodScore } from './mood';

export type RelaxedConstraint = 'budget' | 'category' | 'radius';

// stage1 투표에서 수집한 참여자 선호
export interface Stage1Response {
  drink: DrinkPref;
  budget_min: number;
  budget_max: number;
  categories: string[];
  mood: MoodPref | null;
}

// restaurants 마스터 테이블 행 (카카오 + 웹서치 보완)
export interface RestaurantRow {
  id: string; // restaurants.id (uuid)
  kakao_id: string; // 카카오 place id
  station_id: string;
  name: string;
  category_large: string;
  category_mid: string | null;
  category_small: string | null;
  category_name: string;
  address: string | null;
  road_address: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  distance_m: number | null;
  kakao_url: string | null;
  price_level: number | null;
  avg_price_min: number | null;
  avg_price_max: number | null;
  mood: string[] | null; // 웹서치 확인값. null이면 가중치 0
  source: string | null;
  source_rating: number | null; // null이면 카카오 accuracy 순서 유지
  source_url: string | null;
  crawled_at: string | null;
  created_at: string;
}

export interface RecommendedPlace extends RestaurantRow {
  place_type: PlaceType;
  score: number;
  rank: number;
  relaxed: boolean;
}

export interface PipelineResult {
  recommended: RecommendedPlace[];
  relaxedConstraints: RelaxedConstraint[];
}

// DB엔 최대 STORE_COUNT까지 저장; 화면엔 상위 DISPLAY_COUNT만 노출
const STORE_COUNT = 10;

function scorePlace(
  place: RestaurantRow,
  eligibleCategories: string[],
  quietRatio: number,
): number {
  return (
    scoreByCategoryMatch(place.category_name, eligibleCategories) +
    computeMoodScore(place.mood, quietRatio)
  );
}

function rankPlaces(
  places: RestaurantRow[],
  eligibleCategories: string[],
  quietRatio: number,
  relaxed: boolean,
): RecommendedPlace[] {
  return [...places]
    .sort((a, b) => {
      // 1순위: 카테고리 + 분위기 복합 점수 (높을수록 앞)
      const scoreDiff =
        scorePlace(b, eligibleCategories, quietRatio) -
        scorePlace(a, eligibleCategories, quietRatio);
      if (scoreDiff !== 0) return scoreDiff;

      // 2순위: source_rating DESC NULLS LAST
      // null이면 카카오 accuracy 순서(JS 안정 정렬로 상대 순서 유지)
      const aRating = a.source_rating ?? Number.NEGATIVE_INFINITY;
      const bRating = b.source_rating ?? Number.NEGATIVE_INFINITY;
      if (aRating !== bRating) return bRating - aRating;

      // 3순위: 거리 오름차순
      return (a.distance_m ?? 0) - (b.distance_m ?? 0);
    })
    .slice(0, STORE_COUNT)
    .map((place, idx) => ({
      ...place,
      place_type: classifyPlaceType(place.category_name),
      score: scorePlace(place, eligibleCategories, quietRatio),
      rank: idx + 1,
      relaxed,
    }));
}

export function runPipeline(places: RestaurantRow[], responses: Stage1Response[]): PipelineResult {
  if (responses.length === 0 || places.length === 0) {
    return { recommended: [], relaxedConstraints: [] };
  }

  const drinkPrefs = responses.map((r) => r.drink);
  const budgetCap = computeBudgetCap(responses.map((r) => r.budget_max));
  const eligibleCategories = getEligibleCategories(responses.map((r) => r.categories));
  const quietRatio = computeQuietRatio(responses.map((r) => r.mood));

  // Stage 1: 필터형 — 술 타입 + 예산 (술 제약은 완화하지 않음)
  const typeFiltered = filterByPlaceType(places, drinkPrefs);
  const budgetFiltered = filterByBudget(typeFiltered, budgetCap);

  // Stage 2: 선호형 정렬 — 카테고리 점수 + 분위기 + source_rating + 거리
  if (budgetFiltered.length > 0) {
    return {
      recommended: rankPlaces(budgetFiltered, eligibleCategories, quietRatio, false),
      relaxedConstraints: [],
    };
  }

  // 완화 1: 예산 완충폭 확대 → typeFiltered 전체로 확장 (술 제약 유지)
  if (typeFiltered.length > 0) {
    return {
      recommended: rankPlaces(typeFiltered, eligibleCategories, quietRatio, true),
      relaxedConstraints: ['budget'],
    };
  }

  // 완화 2·3: 카테고리·반경 — 역 반경 내 장소 부족, 반경 확장 필요
  return { recommended: [], relaxedConstraints: ['budget', 'category', 'radius'] };
}
