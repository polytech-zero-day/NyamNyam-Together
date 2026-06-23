# API 명세 (api-spec.md)

> ⚠️ **이 문서의 소유 엔드포인트는 추천 조회·정렬, 식당 등록 뿐이다.**
> 인증·세션·참여·투표 엔드포인트는 **공통/B파트** 소유 → 여기선 **인터페이스로만** 표기.

## 우리 소유 엔드포인트

### 추천
- `GET /sessions/:id/recommendations` — 집계 결과 후보 3~4곳 조회. `?sort=` 미지정 시 세션 sort_mode 적용.
  - status가 voting 이상일 때 유효. 아직이면 202(진행 중).
  - 응답: 후보 배열(place 참조 + relaxed + voteCount) + relaxed 플래그.
  - **표시용 이름·평점은 최종 후보만 라이브 조회**(구글 Place Details) 또는 집계 응답 재사용 후 서버가 합쳐 반환.
  - 구글 데이터 포함 시 응답에 source 표기 → 프론트 "Powered by Google".
- `PATCH /sessions/:id/sort` — 후보 정렬 모드 변경 `{ sortMode }`. **세션 공유**(개인별 아님). voting에서 허용.

### 식당 등록 (확장 — 프론트 화면 우선, 백엔드 스텁)
- `POST /places` — 점주/시민 등록 `{ source(owner|community), stationId, name, lat, lng, category, priceLevel?, openDate? }` → `{ placeId }`. MVP는 first-party 저장 최소 스텁(검증·심사 추후).
- `GET /places?stationId=` — 역의 등록 식당 목록.

## 내부 트리거 (B → 우리)
- B의 상태전환(collecting→aggregating) 시 **recommend 서비스 호출**:
  - 입력: `AggregatedConstraints`(예산 범위·drink 분포·categories+표수·moodDominant) + station 좌표.
  - 처리: 구글 Nearby 라이브 → 파이프라인 → `recommendations` 작성.
  - HTTP 내부 엔드포인트 또는 직접 함수 호출 — 연동 방식은 B와 합의.

## 외부 인터페이스 (공통/B파트 소유 — 참조만)
- 인증: 공통이 userKey 발급. 우리는 요청의 검증된 **userKey만 신뢰**한다. (구현 안 함)
- `POST /sessions`, `GET /sessions/:id`, `POST /sessions/:id/close` — 세션·상태전환 (B)
- `POST /sessions/:id/join` — 입장 (B/공통)
- `POST /sessions/:id/votes/stage1`, `.../stage2` — 투표 수집·집계 (B)
- `GET /sessions/:id/progress` — 진행률 (B)

## 공통 규칙 (우리 엔드포인트)
- 모든 쓰기는 인증 userKey 기준(검증은 공통, 우리는 신뢰). 세션 무관 데이터 접근 차단(RLS).
- 에러 응답 형식 통일(코드+메시지). 구글 호출 실패 graceful 처리.
- 추천은 트리거 1회 생성 후 캐시(재호출 시 재계산 안 함).
- **구글 콘텐츠는 응답 시점에만 라이브 사용**, DB 저장 안 함(place_id 제외).

## 상태 흐름 (소유 표기)
```
collecting → (close/deadline, B) → aggregating → voting → closed   ← 상태전환=B
                                    │
                                    └─ [우리] recommend 서비스: Nearby + 파이프라인 → recommendations
voting: [우리] recommendations 조회·정렬, [B] stage2 투표
```
