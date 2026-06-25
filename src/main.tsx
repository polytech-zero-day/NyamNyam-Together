// 토스 앱 전용 브리지 mock 주입 — 반드시 TDS/AIT import 보다 먼저.
// (브라우저에서 BottomCTA/BottomSheet 가 SafeAreaInsets 못 받아 안 그려지는 문제 해결)
import "./lib/browser-shim";

import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import config from "../granite.config.ts";
import App from "./App.tsx";
import { queryClient } from "./api/queryClient";
import "./index.css";

// dev 목 모드(VITE_USE_MOCK=true)에서만 MSW 워커로 백엔드 계약을 가로챈다.
// 운영 빌드에선 플래그가 꺼져 동적 import 자체가 실행되지 않는다.
async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK !== "true") return;
  const { worker } = await import("./test/msw/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <TDSMobileAITProvider brandPrimaryColor={config.brand.primaryColor}>
          <App />
        </TDSMobileAITProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
});
