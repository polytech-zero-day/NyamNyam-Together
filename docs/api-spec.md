# API 명세 (api-spec.md)

> 엔드포인트는 요청/응답만 담당. 실제 로직은 services·domain. 경로/필드는 구현 시 합의해 확정.

## 인증
- `POST /auth/login` — body `{ authorizationCode, referrer }` → 서버가 토큰 교환·userKey 확보 → 세션 토큰/쿠키 반환. (toss-login.md)

## 세션(모임)
- `POST /sessions` — 모임 생성. body `{ title, stationId, stationLat, stationLng, minParticipants?, purpose?, deadline? }` → `{ sessionId, inviteLink }` (F-01~03)
  - `stationLat`/`stationLng`: station_restaurants 캐시 메타에 역 좌표 등록(없으면 INSERT). 카카오 호출 좌표로 사용.
- `GET /sessions/:id` — 모임 정보·현황(투표 인원, 남은 시간, status). 접근 시 마감 Lazy 체크.
- `POST /sessions/:id/close` — 생성자 수동 종료 → 집계 트리거 (F-09)

## 참여
- `POST /sessions/:id/join` — userKey로 입장(중복 방지) (F-04)

## 투표
- `POST /sessions/:id/votes/stage1` — 제약 응답 `{ drink, budgetMin, budgetMax, categories[], mood }` (F-05~08). 1인 1회.
- `POST /sessions/:id/votes/stage2` — 식당 👍 `{ restaurantId }` (F-13). 1인 1표, 중복 방지.

## 추천
- `GET /sessions/:id/recommendations` — 집계 결과 후보 3~4곳 조회 (F-10~12). relaxed 플래그 포함(완화 공지용).
  - status가 voting 이상일 때만 유효. 아직이면 진행률/대기 응답.

## 진행률
- `GET /sessions/:id/progress` — "N/M명 응답" (F-14). 생성자 종료 판단용.

## 공통 규칙
- 모든 쓰기는 인증된 userKey 기준. 세션 무관 데이터 접근 차단(RLS + 서버 검증).
- 에러 응답 형식 통일(코드 + 메시지). 카카오/토스 외부 호출 실패 시 graceful 처리.
- 집계는 종료 트리거에서 1회. recommendations 생성 후 캐시(같은 세션 재호출 시 재계산 안 함).

## 상태 흐름과 엔드포인트
```
collecting: join, votes/stage1, progress
  ↓ (close 또는 deadline)
aggregating: (서버 내부) 카카오 호출 + 파이프라인 → recommendations 저장
  ↓
voting: recommendations 조회, votes/stage2
  ↓
closed: 결과 조회만
```
