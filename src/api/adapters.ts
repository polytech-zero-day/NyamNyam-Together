// 백엔드 DTO ↔ 프론트 도메인 타입(types.ts) 변환. enum 표기 차이/응답 형태 차이를 여기서 흡수한다.
import type { Alcohol, FoodCategory, Mood, Restaurant, SortOrder } from "../types";
import type { VoteResult } from "../data/dummy-vote-results";
import type {
  BackendDrink,
  BackendMood,
  BackendPlaceType,
  BackendSortMode,
  RecommendationItemDTO,
} from "./dto";

import placeholder1 from "../assets/restaurant-1.png";
import placeholder2 from "../assets/restaurant-2.png";
import placeholder3 from "../assets/restaurant-3.png";

// 구글 사진은 ToS상 수집/저장하지 않으므로(추천 응답에 이미지 없음) 카드 이미지는 목업 placeholder를 순환 사용.
const PLACEHOLDERS = [placeholder1, placeholder2, placeholder3];

// ───────────── enum 매핑 (프론트 → 백엔드) ─────────────
export const ALCOHOL_TO_DRINK: Record<Alcohol, BackendDrink> = {
  drink: "drinker",
  around: "ok",
  uncomfortable: "uncomfortable",
};

export const SORT_TO_BACKEND: Record<SortOrder, BackendSortMode> = {
  reviews: "review_count",
  rating: "rating",
  random: "random",
};

const BACKEND_TO_SORT: Record<BackendSortMode, SortOrder> = {
  review_count: "reviews",
  rating: "rating",
  random: "random",
};
export function backendToSort(mode: BackendSortMode): SortOrder {
  return BACKEND_TO_SORT[mode] ?? "reviews";
}

// 분위기는 MVP 가중치 0(사실상 미사용). 백엔드는 quiet/any만 허용 → 보수적 매핑.
const QUIET_MOODS: Mood[] = ["도란도란 대화", "분위기 있는"];
export function moodToBackend(mood: Mood | undefined): BackendMood | undefined {
  if (mood == null) return undefined;
  return QUIET_MOODS.includes(mood) ? "quiet" : "any";
}

// 음식 카테고리는 한글 그대로 전송(백엔드 category.ts가 한글→google types 매핑).
export function foodsToCategories(foods: FoodCategory[]): string[] {
  return [...foods];
}

// ───────────── 추천 응답 → 카드 ─────────────
// 추천 응답엔 google 식당 카테고리가 없어(types/atmosphere 미수집) placeType으로 간단 라벨 생성.
const PLACE_TYPE_LABEL: Record<BackendPlaceType, string> = {
  drink_required: "술집",
  compatible: "술·식사",
  general: "음식점",
};
function categoryLabel(placeType: BackendPlaceType | null): string {
  return placeType ? PLACE_TYPE_LABEL[placeType] : "음식점";
}

/** 추천 카드 = 프론트 Restaurant 확장. id=recId(2차 투표 키), placeId/mapUrl은 지도용. */
export interface RecommendationCard extends Restaurant {
  recId: string;
  placeId: string;
  rank: number;
  relaxed: boolean;
  source: string | null;
  priceLevel: number | null;
  distanceM: number | null;
  address: string | null;
  mapUrl: string | null;
  voteCount: number;
  poweredByGoogle: boolean;
}

export function toRecommendationCard(dto: RecommendationItemDTO, index: number): RecommendationCard {
  return {
    id: dto.recId, // 2차 투표(restaurantId)는 recId 기준
    name: dto.name ?? "이름 미확인",
    category: dto.category ?? categoryLabel(dto.placeType), // 라이브 업종 우선, 없으면 placeType 라벨

    rating: dto.rating ?? 0,
    userRatingCount: dto.reviewCount ?? 0,
    // 라이브 구글 사진 우선, 없으면 목업 placeholder 순환.
    imageUrl: dto.imageUrl ?? PLACEHOLDERS[index % PLACEHOLDERS.length],
    recId: dto.recId,
    placeId: dto.placeId,
    rank: dto.rank,
    relaxed: dto.relaxed,
    source: dto.source,
    priceLevel: dto.priceLevel,
    distanceM: dto.distanceM,
    address: dto.address,
    mapUrl: dto.mapUrl,
    voteCount: dto.voteCount,
    poweredByGoogle: dto.poweredByGoogle,
  };
}

export function toRecommendationCards(items: RecommendationItemDTO[]): RecommendationCard[] {
  return items.map((dto, i) => toRecommendationCard(dto, i));
}

/** 최종 결과(VoteResult[]) — 득표수 내림차순으로 rank 부여(동점은 추천 rank 보조). */
export function toVoteResults(items: RecommendationItemDTO[]): VoteResult[] {
  const enriched = items.map((dto, i) => ({ dto, card: toRecommendationCard(dto, i) }));
  enriched.sort((a, b) => b.dto.voteCount - a.dto.voteCount || a.dto.rank - b.dto.rank);
  return enriched.map(({ dto, card }, i) => ({
    restaurant: card,
    voteCount: dto.voteCount,
    rank: i + 1,
  }));
}
