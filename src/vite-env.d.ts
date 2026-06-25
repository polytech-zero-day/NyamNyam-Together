/// <reference types="vite/client" />

// 환경변수 타입(선언 병합). 값은 vite의 import.meta.env 로 주입된다(.env / .env.local).
interface ImportMetaEnv {
  /** 백엔드 Edge Function 베이스 URL. 기본값: 로컬 supabase functions serve */
  readonly VITE_API_BASE_URL?: string;
  /** Supabase anon key — 게이트웨이 apikey 헤더용(--no-verify-jwt 로컬에선 불필요) */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** API 타임아웃(ms) */
  readonly VITE_API_TIMEOUT_MS?: string;
  /** 토스 appLogin 실패 시 /auth/dev-login 우회 허용 여부("true"/"false") */
  readonly VITE_ENABLE_DEV_LOGIN?: string;
  /** dev 목 모드 — MSW로 백엔드 계약을 가로채 백엔드 없이 흐름 확인("true"/"false") */
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
