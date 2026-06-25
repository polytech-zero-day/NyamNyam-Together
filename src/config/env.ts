// 런타임 환경설정. 값은 vite import.meta.env(.env/.env.local)에서 주입.
// 백엔드는 Supabase Edge Function(Deno+Hono) 단일 함수 api(basePath '/api').
//   · 로컬:   supabase functions serve api --no-verify-jwt
//             → http://localhost:54321/functions/v1/api
//   · 배포:   https://<project-ref>.supabase.co/functions/v1/api

const DEFAULT_BASE = "http://localhost:54321/functions/v1/api";

/** 모든 API 경로의 prefix. 끝 슬래시는 제거해 path와 안전하게 연결. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, "");

/** Supabase anon key. 있으면 apikey 헤더로 전송(게이트웨이 통과용). */
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/** fetch 타임아웃(ms). */
export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 10_000);

/** 토스 appLogin 실패 시 /auth/dev-login 으로 우회할지(개발 편의, 기본 허용). */
export const ENABLE_DEV_LOGIN_FALLBACK =
  (import.meta.env.VITE_ENABLE_DEV_LOGIN ?? "true") === "true";

/**
 * 초대 링크 기반 URL. Toss WebView에서는 window.location.origin이 CloudFront CDN URL이라
 * 서명 없이 공유하면 MissingKey 에러가 발생함. 미니앱의 공개 URL을 설정.
 * 미설정 시 window.location.origin 폴백(로컬 개발용).
 */
export const INVITE_BASE_URL = (import.meta.env.VITE_INVITE_BASE_URL ?? "").replace(/\/+$/, "");
