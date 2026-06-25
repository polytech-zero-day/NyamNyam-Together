// 백엔드(Edge Function server) 요청/응답 DTO. supabase/functions/server/index.ts 계약을 그대로 반영.
// 프론트 도메인 타입(types.ts)과의 enum/형태 차이는 adapters.ts에서 흡수한다.

// ───────────── 공용 enum (백엔드 표기) ─────────────
export type BackendDrink = "drinker" | "ok" | "uncomfortable";
export type BackendMood = "quiet" | "any";
export type BackendSortMode = "review_count" | "rating" | "random";
export type BackendPlaceSource = "google" | "owner" | "community";
export type BackendPlaceType = "drink_required" | "compatible" | "general";
export type SessionStatus = "collecting" | "aggregating" | "voting" | "closed";

// ───────────── auth ─────────────
export interface TokenResponse {
  token: string;
}
export interface DevLoginResponse {
  token: string;
  userKey: number;
}

// ───────────── stations ─────────────
export interface StationDTO {
  id: string; // 역명(=station_id)
  lat: number;
  lng: number;
}
export interface StationRegionDTO {
  id: string;
  name: string;
  stations: StationDTO[];
}
export interface StationsResponse {
  regions: StationRegionDTO[];
}

// ───────────── sessions ─────────────
export interface CreateSessionRequest {
  stationId: string;
  stationLat?: number;
  stationLng?: number;
  title: string;
  minParticipants?: number;
  purpose?: string;
  deadline?: string; // ISO
}
export interface CreateSessionResponse {
  sessionId: string;
  inviteLink: string;
}

export interface SessionResponse {
  id: string;
  host_user_key: number;
  station_id: string;
  title: string;
  min_participants: number;
  purpose: string | null;
  deadline: string | null;
  status: SessionStatus;
  sort_mode: BackendSortMode;
  sort_seed: number | null;
  winner_recommendation_id: string | null;
  created_at: string;
  participantCount: number;
}

export interface ProgressResponse {
  responded: number;
  total: number;
}

export interface MessageResponse {
  message: string;
}

// ───────────── votes ─────────────
export interface Stage1VoteRequest {
  drink: BackendDrink;
  budgetMin?: number;
  budgetMax: number;
  categories?: string[];
  mood?: BackendMood;
}
export interface Stage2VoteRequest {
  restaurantId: string; // recommendation id(recId)
}

// ───────────── recommendations ─────────────
export interface RecommendationItemDTO {
  recId: string;
  placeId: string;
  rank: number;
  placeType: BackendPlaceType | null;
  relaxed: boolean;
  source: BackendPlaceSource | null;
  name: string | null;
  category: string | null; // 라이브 구글 업종 한글 라벨(또는 등록 식당 category)
  imageUrl: string | null; // 라이브 구글 사진 CDN URL(없으면 프론트가 placeholder)
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  distanceM: number | null;
  address: string | null;
  phone: string | null;
  mapUrl: string | null;
  voteCount: number;
  poweredByGoogle: boolean;
}
export interface RecommendationsResponse {
  sortMode: BackendSortMode;
  relaxed: boolean;
  attribution: string;
  leader: { recId: string; voteCount: number } | null;
  recommendations: RecommendationItemDTO[];
}
/** 집계 전(202)일 때의 응답 형태. */
export interface NotReadyResponse {
  code: "NOT_READY";
  message: string;
  status: SessionStatus;
}

export interface SetSortRequest {
  sortMode: BackendSortMode;
}
export interface SetSortResponse {
  message: string;
  sortMode: BackendSortMode;
}

export interface FinalizeRequest {
  forceWinnerId?: string;
}

// ───────────── places(등록) ─────────────
export interface RegisterPlaceRequest {
  source: "owner" | "community";
  stationId: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  priceLevel?: number;
  openDate?: string;
  placeType?: BackendPlaceType;
}
export interface RegisterPlaceResponse {
  placeId: string;
}
export interface RegisteredPlaceDTO {
  id: string;
  source: BackendPlaceSource;
  name: string;
  lat: number;
  lng: number;
  category: string | null;
  price_level: number | null;
  open_date: string | null;
  place_type: BackendPlaceType | null;
  status: string;
}
export interface ListPlacesResponse {
  places: RegisteredPlaceDTO[];
}
