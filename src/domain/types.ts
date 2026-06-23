// 추천 도메인 공용 타입 (domain-rules.md §0)
// ⚠️ 파이프라인 입력은 "이미 집계된 제약"(B가 votes 집계) + 라이브 구글 Places 후보다.
//    votes 원본 집계(예산 종합·다수결·표수)는 B 소유 → 여기서 구현하지 않는다.

export type PlaceType = 'drink_required' | 'compatible' | 'general';
export type PlaceSource = 'google' | 'owner' | 'community';
export type MoodPref = 'quiet' | 'any';

// B → 우리 (domain-rules.md §0 입력 계약)
export interface AggregatedConstraints {
  drink: { drinker: number; ok: number; uncomfortable: number }; // 분포(인원수)
  budgetMin: number; // 집계된 하한 (소프트)
  budgetMax: number; // 집계된 상한 (주력)
  categories: { name: string; votes: number }[]; // 한글 분류 + 표수
  moodDominant: MoodPref | null;
}

export interface Station {
  id: string;
  lat: number;
  lng: number;
}

/**
 * 파이프라인 후보 1건.
 * - google: 라이브 Nearby 결과(ToS상 콘텐츠 미저장, 세션 내에서만 사용). ref=google_place_id.
 * - owner/community: places 등록 식당(first-party). ref=places.id.
 *
 * 모든 구글 신호(types/priceLevel/rating/userRatingCount)는 라이브 값이며 DB에 저장하지 않는다.
 */
export interface Candidate {
  ref: string; // 후보 식별자: google_place_id(google) 또는 places.id(owner/community)
  placeId: string | null; // 내부 places.id (google은 upsert 후 채워짐, 미상이면 null)
  source: PlaceSource;
  types: string[]; // google types (google) — owner/community는 [] 가능
  primaryType: string | null;
  priceLevel: number | null; // 1~4, null이면 예산 필터 미적용
  rating: number | null;
  userRatingCount: number | null;
  name: string | null; // owner/community 저장값. google은 라이브 표시용(미저장)
  distanceM: number | null;
  // owner/community 등록 식당 전용 (등록 분류로 직접 지정)
  placeTypeOverride: PlaceType | null; // 등록 분류 → place_type 직접 지정
  categoryKorean: string | null; // 등록 한글 분류
  openDate: string | null; // 등록 식당 개업일 (longevity 신호). google은 null
}

// 파이프라인 산출 후보 (recommendations 작성 입력)
export interface RankedCandidate extends Candidate {
  placeType: PlaceType; // 집계 시점 스냅샷
  score: number;
  rank: number;
  relaxed: boolean;
  reviewCountAtAgg: number | null; // = userRatingCount 스냅샷 (정렬·표본보정용)
  ratingAtAgg: number | null; // = rating 스냅샷
}
