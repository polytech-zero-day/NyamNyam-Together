import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./queryClient";
import { isNotReady, useRecommendations, useStations } from "./queries";

// QueryClientProvider 래퍼(테스트마다 캐시 격리). MSW 핸들러는 src/test/setup.ts에서 가동.
function makeWrapper() {
  const client = createQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("queries (client + MSW 통합)", () => {
  it("useStations: 권역/역 목록을 로드한다", async () => {
    const { result } = renderHook(() => useStations(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.regions[0].name).toBe("강남·서초·송파");
    expect(result.current.data?.regions[0].stations[0].id).toBe("강남역");
  });

  it("useRecommendations: 후보 3곳을 로드한다", async () => {
    const { result } = renderHook(() => useRecommendations("sess_demo_1"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data;
    expect(isNotReady(data)).toBe(false);
    if (data && !isNotReady(data)) {
      expect(data.recommendations).toHaveLength(3);
      expect(data.attribution).toBe("Powered by Google");
    }
  });
});
