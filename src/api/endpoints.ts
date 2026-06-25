// 백엔드 엔드포인트별 타입드 호출 함수. (HTTP 세부는 client.ts, SDK 로그인 흐름은 auth.ts)
import { apiRequest } from "./client";
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  DevLoginResponse,
  FinalizeRequest,
  ListPlacesResponse,
  MessageResponse,
  NotReadyResponse,
  ProgressResponse,
  RecommendationsResponse,
  RegisterPlaceRequest,
  RegisterPlaceResponse,
  SessionResponse,
  SetSortRequest,
  SetSortResponse,
  Stage1VoteRequest,
  Stage2VoteRequest,
  StationsResponse,
  TokenResponse,
} from "./dto";

// ───────────── auth ─────────────
export const authApi = {
  anon: () => apiRequest<TokenResponse>("/auth/anon", { method: "POST", auth: false }),
  login: (authorizationCode: string, referrer: string) =>
    apiRequest<TokenResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: { authorizationCode, referrer },
    }),
  devLogin: (userKey?: number) =>
    apiRequest<DevLoginResponse>("/auth/dev-login", {
      method: "POST",
      auth: false,
      body: { userKey },
    }),
};

// ───────────── stations ─────────────
export const stationsApi = {
  list: () => apiRequest<StationsResponse>("/stations", { auth: false }),
};

// ───────────── sessions ─────────────
export const sessionsApi = {
  create: (req: CreateSessionRequest) =>
    apiRequest<CreateSessionResponse>("/sessions", { method: "POST", body: req }),
  get: (sessionId: string) => apiRequest<SessionResponse>(`/sessions/${sessionId}`),
  close: (sessionId: string) =>
    apiRequest<MessageResponse>(`/sessions/${sessionId}/close`, { method: "POST" }),
  finalize: (sessionId: string, req: FinalizeRequest = {}) =>
    apiRequest<unknown>(`/sessions/${sessionId}/finalize`, { method: "POST", body: req }),
  progress: (sessionId: string) =>
    apiRequest<ProgressResponse>(`/sessions/${sessionId}/progress`),
  join: (sessionId: string) =>
    apiRequest<MessageResponse>(`/sessions/${sessionId}/join`, { method: "POST" }),
};

// ───────────── votes ─────────────
export const votesApi = {
  stage1: (sessionId: string, req: Stage1VoteRequest) =>
    apiRequest<MessageResponse>(`/sessions/${sessionId}/votes/stage1`, { method: "POST", body: req }),
  stage2: (sessionId: string, req: Stage2VoteRequest) =>
    apiRequest<MessageResponse>(`/sessions/${sessionId}/votes/stage2`, { method: "POST", body: req }),
};

// ───────────── recommendations ─────────────
export const recommendationsApi = {
  /** 집계 전이면 NotReadyResponse(202)를 반환할 수 있음 — 호출부에서 "recommendations" in res 로 구분. */
  get: (sessionId: string, sort?: SetSortRequest["sortMode"]) =>
    apiRequest<RecommendationsResponse | NotReadyResponse>(
      `/sessions/${sessionId}/recommendations`,
      { query: { sort } },
    ),
  setSort: (sessionId: string, req: SetSortRequest) =>
    apiRequest<SetSortResponse>(`/sessions/${sessionId}/sort`, { method: "PATCH", body: req }),
};

// ───────────── places(등록) ─────────────
export const placesApi = {
  register: (req: RegisterPlaceRequest) =>
    apiRequest<RegisterPlaceResponse>("/places", { method: "POST", body: req }),
  list: (stationId: string) =>
    apiRequest<ListPlacesResponse>("/places", { query: { stationId } }),
};
