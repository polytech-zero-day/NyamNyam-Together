# DB 스키마 (db-schema.md)

> Supabase(PostgreSQL). supabase-js로 접근. 실제 생성 SQL은 `supabase/migrations/`.
> 토스 로그인(userKey 식별) + 역 단위 캐싱(TTL) 반영.

## 테이블 개요

```
sessions (모임)
  ├─ participants (참여자, userKey 식별)
  │    └─ votes (투표: 1단계 응답 + 2단계 식당 👍)
  └─ recommendations (추천 후보, Claude ai_reason 포함)
station_restaurants (역 단위 카카오 캐시, TTL 메타)
restaurants (정규화된 식당 마스터 — 카카오 + 웹서치 보완)
```

---

## 1. sessions — 모임(투표 세션)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | 세션 ID |
| host_user_key | bigint | 생성자(토스 userKey) |
| title | text | 모임명 |
| purpose | text | 목적(friend/couple/parents/etc) — MVP는 friend만 |
| min_participants | int | 최소 인원(집계 트리거 기준) |
| station_id | text | 위치(서울 주요 역 식별자) |
| deadline | timestamptz | 마감 시간 |
| status | text | collecting / aggregating / voting / closed |
| created_at | timestamptz | 생성 시각 |

- status 전환: collecting→(종료 트리거)→aggregating→voting→(마무리)→closed
- deadline은 Lazy 체크(접근 시 now 비교). 수동 종료는 status 직접 변경.

---

## 2. participants — 참여자

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | 참여자 레코드 ID |
| session_id | uuid (FK→sessions) | 소속 세션 |
| user_key | bigint | 토스 userKey (식별자) |
| joined_at | timestamptz | 입장 시각 |

- **(session_id, user_key) UNIQUE** — 같은 세션에 같은 사용자 중복 입장 방지.

---

## 3. votes — 투표

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| session_id | uuid (FK) | |
| user_key | bigint | 누가 투표했는지 |
| stage | int | 1=제약 응답, 2=식당 👍 |
| drink | text | (stage1) 술 수용도: drinker/ok/uncomfortable |
| budget_min | int | (stage1) 1인 예산 하한 |
| budget_max | int | (stage1) 1인 예산 상한 |
| categories | jsonb | (stage1) 음식 카테고리 다중선택 (예: ["한식","고기"]) |
| mood | text | (stage1) 분위기: quiet/any |
| restaurant_id | uuid | (stage2) 투표한 후보 식당 (FK→recommendations) |
| created_at | timestamptz | |

- stage 컬럼으로 1·2단계를 한 테이블에 통합(단순화).
- **stage1: (session_id, user_key) UNIQUE** — 1인 1응답. stage2도 동일하게 1인 1표.

---

## 4. restaurants — 식당 마스터 (카카오 + 웹서치 보완)

> 카카오 API 데이터를 정규화해서 저장. 웹서치로 보완된 컬럼은 null 허용.
> **저장 원칙: 확인된 것만. 추정값 저장 금지. 불확실하면 null.**

| 컬럼 | 타입 | null | 출처 | 설명 |
|---|---|---|---|---|
| id | uuid (PK) | - | - | |
| kakao_id | text (UNIQUE) | NO | 카카오 | 카카오 place id |
| station_id | text (FK→station_restaurants) | NO | 카카오 | 역 식별자 |
| name | text | NO | 카카오 | 상호명 |
| category_large | text | NO | 카카오 | "음식점" |
| category_mid | text | YES | 카카오 | "한식" |
| category_small | text | YES | 카카오 | "육류,고기요리" |
| category_name | text | NO | 카카오 | 원문 전체 (파이프라인 입력) |
| address | text | YES | 카카오 | 지번 주소 |
| road_address | text | YES | 카카오 | 도로명 주소 |
| phone | text | YES | 카카오 | 전화번호 |
| lat | numeric | NO | 카카오 | 위도 (카카오 y) |
| lng | numeric | NO | 카카오 | 경도 (카카오 x) |
| distance_m | integer | YES | 카카오 | 역으로부터 거리(m) |
| kakao_url | text | YES | 카카오 | place_url |
| price_level | integer | YES | 웹서치 | 1(저)~4(고). 미확인 null |
| avg_price_min | integer | YES | 웹서치 | 최소 가격(원). 미확인 null |
| avg_price_max | integer | YES | 웹서치 | 최대 가격(원). 미확인 null |
| mood | text[] | YES | 웹서치 | ["조용한","룸있음"]. 미확인 null |
| source | text | YES | 웹서치 | "다이닝코드" / "식신" |
| source_rating | numeric | YES | 웹서치 | 출처 평점. 미확인 null |
| source_url | text | YES | 웹서치 | 출처 URL. 없으면 null |
| crawled_at | timestamptz | YES | 시스템 | 웹서치 수집 시점 |
| created_at | timestamptz | NO | 시스템 | 최초 저장 시각 |

**null 처리 원칙:**
- `avg_price_min/max`가 null → 예산 필터 미적용, Claude 판단에 위임
- `source_rating`이 null → 카카오 accuracy 정렬 순서 유지
- `mood`가 null → 분위기 필터 미적용
- `source_url` 없으면 해당 식당 웹서치 컬럼 전부 null 처리

---

## 5. recommendations — 추천 후보(집계 결과)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| session_id | uuid (FK→sessions) | 어느 세션의 후보인지 |
| restaurant_id | uuid (FK→restaurants) | 식당 마스터 참조 |
| name | text | 가게명 (비정규화 스냅샷) |
| category_name | text | 카카오 category_name 원문 |
| place_type | text | drink_required/compatible/general |
| lat | double precision | 위도 |
| lng | double precision | 경도 |
| distance | int | 역에서 거리(m) |
| place_url | text | 카카오 상세 URL |
| relaxed | boolean | 조건 완화로 포함됐는지 |
| rank | int | 정렬 순위 |
| ai_reason | text | Claude가 생성한 추천 이유 한 줄 |
| confidence | text | high / medium (low는 저장 안 함) |
| created_at | timestamptz | |

- 집계 시 2단 파이프라인 결과 상위 3~10개 저장. 화면엔 상위 3~4개 노출.
- confidence: low는 최종 추천에서 제외 (저장하지 않음).
- votes.stage2.restaurant_id가 이 테이블을 참조.

---

## 6. station_restaurants — 역 단위 캐시 메타

> payload jsonb 대신 restaurants 테이블에 정규화 저장.
> 이 테이블은 TTL 메타 관리용으로만 사용.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| station_id | text (PK) | 역 식별자 (캐시 키) |
| kakao_fetched_at | timestamptz | 카카오 마지막 호출 시각 (TTL 30일) |
| web_enriched_at | timestamptz | 웹서치 보완 마지막 시각 (TTL 30일) |
| restaurant_count | int | 저장된 식당 수 |

- Lazy TTL: 조회 시 `now - kakao_fetched_at > 30일`이면 카카오 재호출 후 restaurants upsert.
- `web_enriched_at`이 null이거나 만료면 Claude 웹서치 보완 실행.
- 주요 역은 `scripts/seed-restaurants.ts`로 사전 배치.

---

## RLS 정책

> 토스 로그인 기반이지만, 세션 데이터는 링크로 공유되므로 "세션 단위 접근"을 허용한다.

- **sessions/participants/votes/recommendations**: 해당 `session_id`를 아는 사용자는 읽기 가능. 쓰기는 인증된 userKey로 제한.
- **restaurants**: 모든 인증 사용자 읽기 가능. 쓰기는 service_role만.
- **타 세션 데이터 차단**: session_id가 다르면 접근 불가.
- **service_role 키는 서버에서만** 사용. 민감 작업(집계 등)은 서버가 service_role로 수행.

---

## 인덱스

```sql
-- participants
CREATE UNIQUE INDEX ON participants(session_id, user_key);

-- votes
CREATE INDEX ON votes(session_id, user_key, stage);

-- recommendations
CREATE INDEX ON recommendations(session_id, rank);

-- restaurants
CREATE UNIQUE INDEX ON restaurants(kakao_id);
CREATE INDEX ON restaurants(station_id);
CREATE INDEX ON restaurants(station_id, source_rating DESC NULLS LAST);

-- station_restaurants
-- PK가 station_id이므로 별도 인덱스 불필요
```
