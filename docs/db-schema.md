# DB 스키마 (db-schema.md)

> Supabase(PostgreSQL). supabase-js로 접근. 생성 SQL은 `supabase/migrations/`.
> ⚠️ **테이블 설계·RLS는 우리(A파트) 소유.** 단, sessions/participants/votes 위의 **상태전환·투표 집계 로직은 B파트** 소유다(우리는 스키마만 설계, 그 로직은 구현하지 않음).
> 우리 추천 로직이 **쓰는** 테이블은 places / station_places / recommendations 다.

## 테이블 개요

```
sessions (모임, sort_mode)              ← 스키마=우리, 상태전환 로직=B
  ├─ participants (참여자, userKey)      ← 스키마=우리, 입장 로직=B/공통
  │    └─ votes (1·2단계 투표)            ← 스키마=우리, 집계 로직=B
  └─ recommendations (추천 후보 스냅샷)   ← 우리가 작성
station_places (역 단위 place_id 캐시)    ← 우리
places (식당 마스터: google/owner/community) ← 우리
```

> 이전 `restaurants`(카카오+콘텐츠 저장) 폐기 → `places`(출처 구분, 콘텐츠 미저장)로 대체.

---

## 1. sessions — 모임

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | 세션 ID |
| host_user_key | bigint | 생성자 userKey (토스 로그인) |
| title | text | 모임명 |
| purpose | text | 목적(친구/연인/부모님/기타) |
| min_participants | int | **정원(최대 인원, 호스트 포함)** — 전원 stage1 응답 시 자동 집계 |
| station_id | text | 위치(역) 식별자 |
| station_lat / station_lng | numeric | 역 좌표 (searchNearby 호출용) |
| deadline | timestamptz | 마감 시간 — 경과 시 자동 집계 |
| status | text | collecting / aggregating / voting / closed |
| **sort_mode** | text | 후보 정렬: review_count(기본)/rating/random — **참여자 다수결로 결정** |
| **sort_seed** | int | random 정렬 시드(집계 시 1회 고정) |
| **winner_recommendation_id** | uuid | finalize 확정 우승 후보 (FK→recommendations, migration 0004) |
| created_at | timestamptz | |

> 상태 전환·마감·집계·확정 모두 이 백엔드(`api`)가 소유. **정원 전원 응답** 또는 **마감 경과** 시 `aggregate()`.

---

## 2. participants — 참여자  *(스키마 우리 / 입장 로직 B·공통)*

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| session_id | uuid (FK→sessions) | |
| user_key | bigint | 공통 인증이 발급한 식별자 |
| joined_at | timestamptz | |

- **(session_id, user_key) UNIQUE**.

---

## 3. votes — 투표

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| session_id | uuid (FK) | |
| user_key | bigint | |
| stage | int | 1=취향 응답, 2=식당 👍 |
| drink | text | (stage1) drinker/ok/uncomfortable |
| budget_min / budget_max | int | (stage1) 1인 예산 범위 |
| categories | jsonb | (stage1) 한글 분류 다중선택 |
| mood | text | (stage1) quiet/any |
| **sort_pref** | text | (stage1) 정렬 기준 투표 review_count/rating/random (migration 0005) |
| recommendation_id | uuid | (stage2) 투표 후보 (FK→recommendations) |
| created_at | timestamptz | |

- stage1: (session_id, user_key) UNIQUE. stage2도 1인 1표.
- 집계(`voteAggregation`)는 이 백엔드가 수행 — 예산 종합(P25)·카테고리 표수·moodDominant·**정렬 다수결**(`tallySortMode`).

---

## 4. places — 식당 마스터 (출처 구분)  *(우리)*

> 구글 식당은 place_id + 가공값만(콘텐츠 미저장). 등록 식당은 first-party 전체 저장.

| 컬럼 | 타입 | null | 적용 출처 | 설명 |
|---|---|---|---|---|
| id | uuid (PK) | - | 전체 | 내부 식당 ID |
| source | text | NO | 전체 | google / owner / community |
| google_place_id | text (UNIQUE) | YES | google | source=google이면 필수. **ToS상 유일 영구 저장 필드** |
| station_id | text (FK→station_places) | NO | 전체 | 역 식별자 |
| place_type | text | YES | 전체 | 우리 분류 drink_required/compatible/general (가공값, google·owner 모두 저장) |
| name | text | YES | owner/community | 등록 식당만 (google=null, 라이브) |
| lat / lng | numeric | YES | owner/community | 등록 식당만 |
| category | text | YES | owner/community | 한글 분류 (등록 식당만) |
| price_level | int | YES | owner/community | 1~4 점주 신고 |
| open_date | date | YES | owner/community | 개업일 — longevity 신호 |
| status | text | YES | owner/community | active/closed |
| created_at | timestamptz | NO | 전체 | |

- **google 행**: google_place_id·station_id·place_type(google types 가공값으로 계산해 저장)만. 이름·평점·가격·리뷰수는 저장 금지 → 라이브 조회.
- **owner/community 행**: 콘텐츠 전체 저장 가능(first-party, ToS 무관).

---

## 5. recommendations — 추천 후보 스냅샷  *(우리가 작성)*

> 구글 콘텐츠 비정규화 저장 안 함 — place 참조 + 우리 생성/파생값만.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| session_id | uuid (FK→sessions) | |
| place_id | uuid (FK→places) | 내부 식당 참조 |
| place_type | text | 집계 시점 스냅샷 |
| rank | int | 파이프라인 순위 |
| relaxed | boolean | 조건 완화 포함 여부 |
| review_count_at_agg | int | 집계 시점 userRatingCount 스냅샷 — **정렬·표본보정용 내부 수치** |
| rating_at_agg | numeric | 집계 시점 rating 스냅샷 — 정렬용 |
| created_at | timestamptz | |

> *_at_agg는 코드가 순위를 매기기 위한 내부 파생 수치다(사용자 재노출용 콘텐츠 캐시 아님).
> 화면 노출용 최신 이름·평점은 표시 시점에 라이브 조회(최종 3~4곳, Place Details).
- 상위 3~10개 저장, 화면엔 3~4개(sort_mode 정렬). stage2 투표(B)가 recommendation_id로 참조.

---

## 6. station_places — 역 단위 place_id 디스커버리 메타  *(우리)*

| 컬럼 | 타입 | 설명 |
|---|---|---|
| station_id | text (PK) | 캐시 키 |
| station_lat / station_lng | numeric | Nearby 호출 좌표 |
| places_discovered_at | timestamptz | 마지막 Nearby 시각 (TTL 30일) |
| place_count | int | 디스커버리된 place 수 |

- TTL은 "역 재탐색 주기"에만 적용. **place_id는 만료·삭제하지 않는다(영구).**

---

## RLS 정책  *(우리 소유)*

- sessions/participants/votes/recommendations: 해당 session_id를 아는 사용자 읽기 가능. 쓰기는 인증 userKey로 제한.
- places: 인증 사용자 읽기 가능. google 행 쓰기 service_role만. owner/community 등록 쓰기는 인증 userKey(MVP는 스텁이라 service_role 경유).
- 타 세션 데이터 차단(session_id 다르면 불가). service_role 키는 서버에서만.

---

## 인덱스

```sql
CREATE UNIQUE INDEX ON participants(session_id, user_key);
CREATE INDEX ON votes(session_id, user_key, stage);
CREATE INDEX ON recommendations(session_id, rank);
CREATE UNIQUE INDEX ON places(google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX ON places(station_id);
CREATE INDEX ON places(source);
```