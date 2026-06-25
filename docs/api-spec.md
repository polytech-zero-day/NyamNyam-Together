# API 명세 (api-spec.md)

> Supabase Edge Function `api`, basePath **`/api`**. 배포 URL: `https://<ref>.supabase.co/functions/v1/api`.
> 인증: 자체 JWT(`Authorization: Bearer <token>`). 미들웨어 `requireAuth`(토스/익명) · `requireToss`(토스만) · `requireParticipant`(세션 멤버).

## 인증
- `POST /auth/anon` → `{ token }` — 참여자용 익명 JWT(음수 userKey).
- `POST /auth/login` `{ authorizationCode, referrer }` → `{ token }` — 토스 mTLS 인가코드 교환 → userKey → JWT.
- `POST /auth/dev-login` `{ userKey }` → `{ token, userKey }` — 개발용. `ENV=production`이면 404.

## 역(스테이션)
- `GET /stations` → `{ regions: [{ id, name, stations:[{id,lat,lng}] }] }` — 큐레이션 권역·역 목록.

## 세션
- `POST /sessions` (requireToss) `{ stationId, stationLat, stationLng, title, minParticipants, purpose, deadline }` → `{ sessionId, inviteLink }` (201). 생성자는 participants에 자동 등록. *minParticipants = 정원(최대 인원, 호스트 포함).*
- `GET /sessions/:id` (requireAuth) → 세션 정보 + `participantCount`. (읽기 시 마감 경과면 자동 집계 트리거)
- `POST /sessions/:id/join` (requireAuth) → 참여(201). collecting 아니면 409.
- `POST /sessions/:id/close` (requireToss, 생성자) → 즉시 집계 시작.
- `POST /sessions/:id/finalize` (requireToss, 생성자) `{ forceWinnerId? }` → `{ isTied, winnerId, voteCount }`.
- `GET /sessions/:id/progress` (requireAuth) → `{ responded, total, min }` — **호스트 포함** stage1 진행 인원 + 정원.

## 투표
- `POST /sessions/:id/votes/stage1` (requireAuth) `{ drink, budgetMin?, budgetMax, categories?, mood?, sortPref? }` → 201.
  - drink ∈ drinker/ok/uncomfortable, mood ∈ quiet/any, sortPref ∈ review_count/rating/random.
  - **정원 전원 응답 시 자동 집계.**
- `POST /sessions/:id/votes/stage2` (requireAuth) `{ restaurantId }` → 201. status=voting에서만.

## 추천
- `GET /sessions/:id/recommendations` (requireParticipant) → `{ sortMode, relaxed, attribution, leader, recommendations[] }`.
  - collecting/aggregating이면 **202 NOT_READY**.
  - 각 후보: recId·placeId·rank·placeType·name·**category·imageUrl(라이브)**·rating·reviewCount·priceLevel·distanceM·address·mapUrl·voteCount.
  - 정렬은 `session.sort_mode`(참여자 다수결 결정). `?sort=`로 뷰 override 가능.
- `PATCH /sessions/:id/sort` (requireToss, 생성자) `{ sortMode }` — 정렬 수동 변경(현재 흐름은 stage1 다수결 사용, 보조).

## 식당 등록
- `POST /places` (requireAuth) `{ source(owner|community), stationId, name, lat, lng, category, priceLevel?, openDate?, placeType? }` → `{ placeId }`.
- `GET /places?stationId=` (requireAuth) → 등록 식당 목록.

## 공통
- 에러: `{ code, message }` + HTTP status (400/401/403/404/409/500).
- 구글 콘텐츠는 **응답 시점에만 라이브** 사용, DB 저장 안 함(place_id 제외). 출처 "Powered by Google".
- 헬스체크: `GET /health` → `{ status: "ok" }`.

## 상태 흐름
```
collecting → (정원 전원 응답 OR 마감 경과 OR 호스트 close) → aggregating
  → [recommend: 카테고리로 좁힌 구글 검색 + 파이프라인 → recommendations] → voting
  → stage2 투표 → finalize → closed(winner_recommendation_id)
```
