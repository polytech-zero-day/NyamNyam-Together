// TanStack Query 훅 레이어. endpoints.ts(transport)를 useQuery/useMutation으로 감싼다.
//  - 조회(GET): 캐싱 + 필요한 곳만 폴링(refetchInterval)
//  - 쓰기(POST/PATCH): useMutation + 성공 시 관련 쿼리 무효화
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  placesApi,
  recommendationsApi,
  sessionsApi,
  stationsApi,
  votesApi,
} from "./endpoints";
import type {
  CreateSessionRequest,
  FinalizeRequest,
  NotReadyResponse,
  ProgressResponse,
  RecommendationsResponse,
  RegisterPlaceRequest,
  SessionResponse,
  SetSortRequest,
  Stage1VoteRequest,
  Stage2VoteRequest,
  StationsResponse,
} from "./dto";

// ───────────── query keys ─────────────
export const queryKeys = {
  stations: ["stations"] as const,
  session: (id: string) => ["session", id] as const,
  progress: (id: string) => ["progress", id] as const,
  recommendations: (id: string, sort?: string) => ["recommendations", id, sort ?? null] as const,
  places: (stationId: string) => ["places", stationId] as const,
};

// ───────────── 조회 ─────────────
export function useStations(): UseQueryResult<StationsResponse> {
  return useQuery({
    queryKey: queryKeys.stations,
    queryFn: () => stationsApi.list(),
    staleTime: 60 * 60_000, // 역 목록은 거의 불변 → 1시간
  });
}

export function useSession(sessionId: string | null): UseQueryResult<SessionResponse> {
  return useQuery({
    queryKey: queryKeys.session(sessionId ?? ""),
    queryFn: () => sessionsApi.get(sessionId!),
    enabled: sessionId != null && sessionId !== "",
  });
}

/** 응답 진행률(N/M). collecting 동안만 폴링하도록 호출부에서 enabled 제어. */
export function useProgress(
  sessionId: string | null,
  options: { enabled?: boolean; pollMs?: number } = {},
): UseQueryResult<ProgressResponse> {
  const { enabled = true, pollMs = 3_000 } = options;
  return useQuery({
    queryKey: queryKeys.progress(sessionId ?? ""),
    queryFn: () => sessionsApi.progress(sessionId!),
    enabled: enabled && sessionId != null && sessionId !== "",
    refetchInterval: pollMs,
  });
}

export type RecommendationsResult = RecommendationsResponse | NotReadyResponse;

export function isNotReady(res: RecommendationsResult | undefined): res is NotReadyResponse {
  return res != null && (res as NotReadyResponse).code === "NOT_READY";
}

/**
 * 추천 후보 조회. 집계 전(202 NOT_READY)이면 그 응답을 그대로 받아 폴링을 이어가고,
 * voting에 진입해 후보가 채워지면 폴링을 늦춘다(득표수 갱신용).
 */
export function useRecommendations(
  sessionId: string | null,
  sort?: SetSortRequest["sortMode"],
  options: { enabled?: boolean; pollMs?: number } = {},
): UseQueryResult<RecommendationsResult> {
  const { enabled = true, pollMs = 3_000 } = options;
  return useQuery({
    queryKey: queryKeys.recommendations(sessionId ?? "", sort),
    queryFn: () => recommendationsApi.get(sessionId!, sort),
    enabled: enabled && sessionId != null && sessionId !== "",
    refetchInterval: (query) => (isNotReady(query.state.data) ? pollMs : pollMs * 2),
  });
}

export function usePlaces(stationId: string | null) {
  return useQuery({
    queryKey: queryKeys.places(stationId ?? ""),
    queryFn: () => placesApi.list(stationId!),
    enabled: stationId != null && stationId !== "",
  });
}

// ───────────── 쓰기(뮤테이션) ─────────────
export function useCreateSession() {
  return useMutation({
    mutationFn: (req: CreateSessionRequest) => sessionsApi.create(req),
  });
}

export function useJoinSession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sessionsApi.join(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.progress(sessionId) }),
  });
}

export function useStage1Vote(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: Stage1VoteRequest) => votesApi.stage1(sessionId, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.progress(sessionId) }),
  });
}

export function useStage2Vote(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: Stage2VoteRequest) => votesApi.stage2(sessionId, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations", sessionId] }),
  });
}

export function useSetSort(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: SetSortRequest) => recommendationsApi.setSort(sessionId, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations", sessionId] }),
  });
}

export function useCloseSession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sessionsApi.close(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session(sessionId) }),
  });
}

export function useFinalize(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: FinalizeRequest = {}) => sessionsApi.finalize(sessionId, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session(sessionId) }),
  });
}

export function useRegisterPlace() {
  return useMutation({
    mutationFn: (req: RegisterPlaceRequest) => placesApi.register(req),
  });
}
