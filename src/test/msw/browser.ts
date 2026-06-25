// 브라우저용 MSW 워커 — dev 목 모드(VITE_USE_MOCK=true)에서만 main.tsx가 동적 import.
// 백엔드 없이 프론트 전체 흐름을 계약(handlers) 기준으로 E2E 확인할 때 사용.
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
