import { MutationCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";
import { showToast } from "../lib/toast";

function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : "요청 중 문제가 발생했어요";
}

// 앱 전역 QueryClient. 웹뷰 단발 세션 특성상 보수적 기본값.
//   · retry 1회(네트워크 흔들림 흡수, 과도한 재시도 방지)
//   · staleTime 짧게(세션 상태가 자주 바뀜) — 폴링은 훅별 refetchInterval로 제어
//   · 쓰기(mutation) 실패는 전역 토스트로 사용자에게 안내(조회 실패는 화면별 상태로 처리)
export function createQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => showToast(errorMessage(error), "error"),
    }),
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 5_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// 앱 런타임용 단일 인스턴스(스토리/테스트는 자체 인스턴스를 만들어 격리).
export const queryClient = createQueryClient();
