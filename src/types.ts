export type ScreenId =
  | "intro"
  | "welcome"
  | "login-consent"
  | "participant-onboarding"
  | "create-meeting"
  | "invite-generated"
  | "invite-input"
  | "q-hub"
  | "q-food"
  | "q-done"
  | "wait-others"
  | "all-done"
  | "finding"
  | "relaxed"
  | "sort-select"
  | "vote"
  | "vote-candidates"
  | "second-vote-waiting"
  | "vote-counting"
  | "final-result"
  | "vote-info-closed";

export type Purpose =
  | "친구들과의 모임"
  | "연인과의 데이트"
  | "부모님과의 식사"
  | "기타";

export type Alcohol = "drink" | "around" | "uncomfortable";

// 술 수용도(F-05) 3지선다 → 시안(사용자_투표_2) 문구 매핑.
// id는 추천엔진의 술→장소타입 매핑에 쓰이므로 바꾸지 않는다.
export const ALCOHOL_OPTIONS: { id: Alcohol; label: string }[] = [
  { id: "drink", label: "술 마실 거예요" },
  { id: "around", label: "안 마셔도 술자리는 괜찮아요" },
  { id: "uncomfortable", label: "술 없는 곳이 편해요" },
];

// 예산(사용자_투표_4): 5단계 단일선택. 라벨 표시용 + 추천엔진(3.3)이 쓰는 min~max(원) 범위.
export const BUDGET_TIERS = [
  { label: "1만원 이하", min: 0, max: 10000 },
  { label: "1~2만원", min: 10000, max: 20000 },
  { label: "2~3만원", min: 20000, max: 30000 },
  { label: "3~4만원", min: 30000, max: 40000 },
  { label: "4만원 이상", min: 40000, max: 100000 },
] as const;
export type BudgetTierLabel = (typeof BUDGET_TIERS)[number]["label"];

// 음식 카테고리(사용자_투표_6/7): 시안 기준 8종. (기능정의서 F-07의 간편식/치킨·안주는 시안에 없어 제외)
export const FOOD_CATEGORIES = [
  "한식",
  "일식",
  "양식",
  "중식",
  "분식",
  "아시안",
  "고기·구이",
  "카페·브런치",
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

// 분위기(사용자_투표_9): 시안 기준 4종. (기능정의서 F-08의 "상관없어요"는 시안에 없어 제외)
export const MOOD_OPTIONS = [
  "편하게 먹는",
  "도란도란 대화",
  "왁자지껄한",
  "분위기 있는",
] as const;
export type Mood = (typeof MOOD_OPTIONS)[number];

// 권역/역 데이터는 src/data/stations.ts로 분리 (백엔드 API 연동 시 데이터 파일만 교체하면 됨).
// 기존 import 경로(`./types`)는 유지하기 위해 type만 re-export.
export type { RegionId } from "./data/stations";

// F-12 후보 카드. CLAUDE.md 3.5 / 6장 기준:
//   영구 저장 가능한 건 place_id 뿐, 나머지(name·rating 등)는 라이브 조회 후 세션 내 폐기.
//   reason(AI 추천 이유)는 F-15 폐기로 제거.
export interface Restaurant {
  id: string; // 구글 place_id (영구 저장 가능한 유일 키)
  name: string;
  category: string;
  rating: number;
  userRatingCount: number;
  imageUrl: string;
}

// F-16 정렬 기준 선택.
export type SortOrder = "reviews" | "rating" | "random";

export const SORT_OPTIONS: {
  id: SortOrder;
  label: string;
  subText: string;
}[] = [
  {
    id: "reviews",
    label: "리뷰 많은 순",
    subText: "많은 사람이 다녀간 곳으로",
  },
  {
    id: "rating",
    label: "평점 높은 순",
    subText: "만족도가 높은 순으로",
  },
  {
    id: "random",
    label: "랜덤 추천",
    subText: "새로운 곳도 가볼래요",
  },
];
