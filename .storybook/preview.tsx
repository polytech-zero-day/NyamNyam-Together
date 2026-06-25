// 토스 브리지 mock — TDS import보다 먼저(브라우저에서 시트/CTA 렌더 보장).
import "../src/lib/browser-shim";

import type { Preview } from "@storybook/react";
import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { QueryClientProvider } from "@tanstack/react-query";
import { initialize, mswLoader } from "msw-storybook-addon";
import config from "../granite.config";
import { createQueryClient } from "../src/api/queryClient";
import { handlers } from "../src/test/msw/handlers";
import "../src/index.css";

// MSW 서비스워커 시작(미정의 요청은 통과시켜 정적 에셋 로딩 방해 안 함).
initialize({ onUnhandledRequest: "bypass" });

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    msw: { handlers },
  },
  loaders: [mswLoader],
  decorators: [
    (Story) => (
      // 스토리마다 새 QueryClient로 캐시 격리
      <QueryClientProvider client={createQueryClient()}>
        <TDSMobileAITProvider brandPrimaryColor={config.brand.primaryColor}>
          <Story />
        </TDSMobileAITProvider>
      </QueryClientProvider>
    ),
  ],
};

export default preview;
