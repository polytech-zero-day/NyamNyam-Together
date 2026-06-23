# CLAUDE.md — 냠냠투게더 백엔드 (A·C 파트 / 추천 서버)

> Claude Code가 매번 참조하는 전역 컨텍스트. 코드 생성·수정 전 이 규칙을 우선 따른다.
> ⚠️ **이 레포의 소유 범위는 A(스키마+RLS)와 C(구글 Places + 추천 로직)다.**
> B파트(세션 로직·RPC·상태머신·투표 집계·Realtime)와 공통(인증·CORS)은 **다른 담당이 소유**한다.
> 우리는 그 부분의 로직을 구현하지 않고, 정해진 **인터페이스로만** 주고받는다.

---

## 0. 소유 경계 (★ 먼저 읽기)

| 파트 | 내용 | 소유 |
|---|---|---|
| **A** | sessions/participants/votes/places/station_places/recommendations **테이블 설계 + RLS** | **우리** |
| **C** | 구글 Places 연동 + 추천 파이프라인(필터/정렬/longevity) | **우리** |
| B | 세션 생성·상태전환·마감, 1단계 투표 집계(예산·다수결), 2단계 최종 집계·동점, Realtime | 외부 |
| 인증 | 토스 로그인 → userKey (변경 없음) | **우리(잠정)** — 소유 경계 협의 예정 |
| 공통 | CORS 등 | 외부 |

**핸드오프 (이 경계 밖은 구현하지 않는다):**
```
B → 우리(입력): 집계된 제약 { drink 분포, budgetMin, budgetMax, categories(+표수), moodDominant }
                + station { id, lat, lng }
우리(처리):    구글 Nearby 라이브 → 파이프라인 → 후보 3~10
우리 → B(출력): recommendations 테이블에 후보 작성 (place ref, rank, relaxed)
트리거:        B의 상태전환(collecting→aggregating)에서 우리 recommend 서비스 호출
              ※ 상태머신·마감타이머·stage2 투표·동점·Realtime은 우리가 소유하지 않음
```

**⚠️ B파트 브랜치 병합 시 유의 (Claude Code로 병합 예정):**
- **로직 중복 금지**: 상태전환·1·2단계 투표 집계·동점·Realtime은 B 코드를 정본으로 채택. 우리 쪽에 같은 로직이 생겼으면 제거하고 호출/입력으로만 연결.
- **우리 경계 보존**: 구글 Places·추천 파이프라인·places/recommendations 작성은 우리 코드를 정본으로 유지.
- **연결 지점은 단 하나**: B 상태전환 → 우리 `recommend` 호출(입력=AggregatedConstraints) → recommendations 작성. 그 외 결합 만들지 말 것.
- 트리거 방식(내부 함수 호출 vs HTTP/DB 웹훅)은 B가 Node로 합류하는지에 따라 갈림 → 병합 시점에 확정.

## 1. 프로젝트 개요 (우리 범위)

냠냠투게더(앱인토스 미니앱)의 **추천 서버**.
- 역할: **구글 Places 미들웨어(키 보호·place_id 캐시)** + **추천 파이프라인(선정 로직)** + 스키마·RLS.
- 핵심 철학: **확정기가 아닌 압축기.** 후보 3~4곳으로 좁혀주고 선택은 사용자.
- AI 역할: **선정·필터·정렬은 전부 코드.** 외부 LLM·AI 추천 이유는 **사용하지 않는다.**

> 이전(카카오 + 웹서치 보완)에서 **구글 Places API(New) 단일 소스**로 전환됨. 카카오·다이닝코드·식신·네이버 로직 폐기.

## 2. 기술 스택 (고정)

- **Node.js + TypeScript**
- **@supabase/supabase-js** — DB 접근 (★ ORM 금지)
- **Supabase (PostgreSQL + RLS)** — DB 역할만. 추천 로직은 Node가 담당
- HTTP 프레임워크: Express(또는 동급 경량). 과한 추상화 지양
- 타입: Supabase CLI 생성 `database.types.ts`
- **구글 Places API (New)** — Nearby Search / Place Details (서버만 호출)

> Edge Function(Deno)·RPC 비즈니스 로직은 우리 범위 아님. 외부 LLM 의존 없음. 우리 로직은 전부 Node.

## 3. 아키텍처 (우리 범위)

```
[B파트: 세션·투표 오케스트레이션 (외부)]
   │ 상태전환(collecting→aggregating) 시 호출 + 집계 제약 전달
   ▼
[Node 추천 서버]  ← 이 레포 (A·C)
   ├─ 구글 Places: Nearby Search(집계 1회) + Place Details(최종 후보만)
   ├─ 도메인: 2단 파이프라인(순수 함수)  ← 입력은 "이미 집계된 제약"
   └─ @supabase/supabase-js → recommendations 작성
        │
        ▼
[Supabase: PostgreSQL + RLS]  ← place_id + 우리 가공/등록 데이터만 저장
```

## 4. 폴더 구조 (우리 범위)

```
src/
├─ config/supabase.ts
├─ domain/                   # ★ 순수 함수 (입력=집계된 제약, 외부 의존 X, 테스트 필수)
│  ├─ placeType.ts           # 술 분포 → 허용 장소타입 (google types 매핑)
│  ├─ budget.ts              # budget 범위 → priceLevel 밴드 컷 (max 주력·min 소프트)
│  ├─ category.ts            # 카테고리 2표 채택 + 매칭 점수 (한글↔google types)
│  ├─ mood.ts                # 분위기 가중치 (현재 0, 사실상 미사용)
│  ├─ sort.ts                # 후보 정렬 (리뷰수/평점/무작위)
│  ├─ longevity.ts           # 등록 식당 open_date 가점
│  ├─ pipeline.ts            # 2단 파이프라인 통합
│  └─ __tests__/
├─ services/
│  ├─ googlePlaces.ts        # Nearby/Place Details + place_id 캐시  (google-places-api.md)
│  └─ recommend.ts           # 집계 제약 입력 → 파이프라인 → recommendations 작성 (B가 호출)
├─ routes/
│  ├─ recommend.ts           # GET 후보 조회 + 정렬(sort_mode)
│  └─ places.ts              # 점주/시민 식당 등록 (프론트 스텁, 로직 최소)
├─ types/database.types.ts
└─ index.ts
supabase/migrations/         # 전체 테이블 SQL (A파트 — 우리가 스키마·RLS 소유)
scripts/
└─ seed-places.ts            # 주요 역 place_id 워밍 (배포 안 함)
```

> sessions/participants/votes의 **스키마는 우리(A)가 설계**하지만, 그 위의 **상태전환·투표 집계 로직은 B**다.
> 우리 코드는 votes를 직접 집계하지 않는다. B가 집계한 제약을 입력으로 받는다.

## 5. 도메인 규칙 — ⚠️ AI 임의 변경 금지

> 상세는 `docs/domain-rules.md`. **파이프라인 입력은 "이미 집계된 제약" + 라이브 구글 Places 데이터.**

요약 (우리 범위):
- 2단 파이프라인: 필터형(술·예산·위치) → 선호형(음식 2표·평점신호·longevity) → 상위 3~4곳
- 술: 받은 drink 분포로 허용 장소타입 결정 후 필터 (google `types` 매핑)
- 예산: budget 범위 → priceLevel 밴드. **max 주력 필터(P25 완충), min 소프트**, priceLevel null이면 통과
- 음식: **2표 이상 카테고리 채택(우리 소유)** → 매칭 점수(정렬용)
- 평점 신호: userRatingCount 우선 + rating 보조, 표본 얇으면 신뢰 하향
- 분위기: 가중치 0(사실상 미사용)
- longevity: 등록 식당 open_date 약한 가점(없으면 0)
- 0개 완화: 예산(min 먼저)→카테고리→반경 순, 술 제약 유지 + relaxed 플래그
- 정렬: sort_mode ∈ 리뷰수순(기본)/평점순/무작위 — 세션 공유, 후보·집계 불변

## 6. 데이터 소스·캐싱·ToS (google-places-api.md 참조)

- 구글 Places는 서버만 호출. Nearby Search 1회=과금 1건, 결과 최대 20개.
- 필드마스크는 **최고 티어 1개로만 과금** → **Enterprise 단일 호출**로 고정(필드는 google-places-api.md).
- ❌ **Enterprise + Atmosphere 필드 금지**(`reviews` 본문, `editorialSummary`, `servesXxx`, `goodForGroups` 등). "리뷰순"은 `userRatingCount`로 구현.
- **ToS: place_id만 영구 저장.** 그 외 구글 콘텐츠는 저장 금지 → 집계/표시 시 라이브 후 세션 내 사용·폐기.
- stale place_id: `CLOSED_PERMANENTLY` 비활성 / `movedPlaceId` 교체. 출처 표기 "Powered by Google"(프론트).
- 출처 구분: `places.source` ∈ google / owner / community. google=place_id+가공값만, 등록=first-party 전체.

## 7. 우리가 소유하지 않는 것 (B파트·공통 — 참조만)

- 세션 생성/상태전환/마감 트리거, 1·2단계 투표 집계, 동점 처리, Realtime → **B파트**
- CORS 등 → **공통**
- **인증(토스 로그인 → userKey)은 우리(잠정, 변경 없음)** — `toss-login.md`. B/공통과의 소유 경계는 협의 예정.
- 우리는 호출 시 **검증된 userKey를 신뢰**하고, **집계된 제약을 입력**으로 받을 뿐 B 로직은 구현하지 않는다.

## 8. 금지 사항

- ❌ 구글 Places 콘텐츠 DB 저장(place_id 제외)
- ❌ Enterprise + Atmosphere 필드 요청
- ❌ 구글 데이터와 등록(owner/community) 데이터 혼동 — `source`로 항상 구분
- ❌ 외부 LLM·웹서치·AI 추천 이유 도입 (MVP 범위 밖)
- ❌ **B파트·공통 로직 중복 구현**(상태머신·투표 집계·Realtime·인증) — 인터페이스만
- ❌ ORM 도입, Edge Function(Deno)로 우리 로직 작성
- ❌ 시크릿(구글 키, Supabase service_role) 하드코딩·git 커밋
- ❌ RLS 우회 / 5장 도메인 규칙 임의 변경 / Out of Scope(더치페이·푸시·AI 후기분석)

## 9. 참고 문서 (docs/)
- `db-schema.md` — 전체 테이블 설계 + RLS (A파트, 우리 소유)
- `domain-rules.md` — 추천 파이프라인 + 정렬 + longevity (입력=집계된 제약)
- `google-places-api.md` — 구글 Places 호출·SKU·ToS 캐싱
- `api-spec.md` — 우리 엔드포인트(추천 조회·정렬, 등록) + B/공통 인터페이스
- `toss-login.md` — 토스 로그인 → userKey (우리 잠정, 변경 없음. 소유 경계 협의 예정)
