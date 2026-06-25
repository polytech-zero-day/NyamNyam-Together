// MSW 요청 핸들러 — 스토리(Storybook 서비스워커)와 테스트(Vitest node 서버) 공용.
// 백엔드 없이 결정적 응답을 돌려준다. 경로는 API_BASE_URL 기준.
import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "../../config/env";
import { recommendationsFixture, sessionFixture, stationsFixture } from "./fixtures";

const url = (path: string) => `${API_BASE_URL}${path}`;

export const handlers = [
  // auth
  http.post(url("/auth/anon"), () => HttpResponse.json({ token: "mock-anon-token" })),
  http.post(url("/auth/login"), () => HttpResponse.json({ token: "mock-host-token" })),
  http.post(url("/auth/dev-login"), () =>
    HttpResponse.json({ token: "mock-dev-token", userKey: 1001 }),
  ),

  // stations
  http.get(url("/stations"), () => HttpResponse.json(stationsFixture)),

  // sessions
  http.post(url("/sessions"), () =>
    HttpResponse.json(
      { sessionId: sessionFixture.id, inviteLink: `/sessions/${sessionFixture.id}/join` },
      { status: 201 },
    ),
  ),
  http.get(url("/sessions/:id"), () => HttpResponse.json(sessionFixture)),
  http.post(url("/sessions/:id/close"), () => HttpResponse.json({ message: "집계를 시작했습니다" })),
  http.post(url("/sessions/:id/finalize"), () =>
    HttpResponse.json({ winnerRecommendationId: "rec_2", tie: false }),
  ),
  http.get(url("/sessions/:id/progress"), () => HttpResponse.json({ responded: 3, total: 4 })),
  http.post(url("/sessions/:id/join"), () =>
    HttpResponse.json({ message: "참여가 완료됐습니다" }, { status: 201 }),
  ),

  // votes
  http.post(url("/sessions/:id/votes/stage1"), () =>
    HttpResponse.json({ message: "응답이 완료됐습니다" }, { status: 201 }),
  ),
  http.post(url("/sessions/:id/votes/stage2"), () =>
    HttpResponse.json({ message: "투표가 완료됐습니다" }, { status: 201 }),
  ),

  // recommendations
  http.get(url("/sessions/:id/recommendations"), () => HttpResponse.json(recommendationsFixture)),
  http.patch(url("/sessions/:id/sort"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { sortMode?: string };
    return HttpResponse.json({ message: "정렬 모드를 변경했습니다", sortMode: body.sortMode ?? "review_count" });
  }),

  // places
  http.post(url("/places"), () => HttpResponse.json({ placeId: "place_demo_1" }, { status: 201 })),
  http.get(url("/places"), () => HttpResponse.json({ places: [] })),
];
