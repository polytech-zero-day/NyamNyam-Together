# B ↔ C 통합 인터페이스 계약 (integration-contract.md)

> ⚠️ **이력 문서.** B(세션·투표·집계)와 C(추천)는 현재 **단일 백엔드(`api` 함수)로 통합 완료**되어 아래 B↔C 분리 계약은 런타임에 존재하지 않는다. 실제 동작은 `docs/domain-rules.md`·`docs/api-spec.md` 참고. (통합 이전 설계 기록용 보존.)

> 통합 브랜치 `integ/backend-merge` 기준. **C(추천)는 이 계약의 "입력"만 신뢰**하고, 그 입력을 만드는
> **B(투표 집계·상태전환)의 구현은 합류 대기**다(여기선 계약만 고정).
> ⚠️ 기존 `feat/supabase-backend-setup`(K-yoon03)의 B는 **피벗 이전 스택**(카카오 + Edge Function +
> Supabase Auth + EAV votes + 항목별 최빈값 집계)이라 **그대로 채택하지 않는다.** 신스택으로 재정의 필요.

## 0. 스택 전제 (신스택 — han·yang 공통)
- 데이터 소스: **구글 Places API(New)** (카카오·Edge Function 폐기)
- 런타임: **Node + TypeScript** (RPC 비즈니스 로직 아님)
- 사용자 식별: **인증 모델 B** (아래 0-1) — Supabase `auth.uid()` 아님
- ToS: `places`엔 google `place_id` + 우리 가공 `place_type`만 영구 저장. 콘텐츠는 라이브 후 폐기.

### 0-1. 인증 모델 B (host=토스 / 참여자=익명)
> 제품 결정: 전원 로그인은 마찰이 크다 → **그룹 생성·종료(host)만 토스 식별**, **참여자는 로그인 없이 링크로 입장**.
- **host**: 토스 `appLogin()` → `POST /auth/login` → JWT(`kind:'toss'`, userKey=양수). `requireToss` 가드.
- **참여자**: `POST /auth/anon` → JWT(`kind:'anon'`, 음수 랜덤 id). `requireAuth`(익명 허용).
- `participants.user_key`/`votes.user_key`(bigint)에 **양수=토스 / 음수=익명**을 함께 저장 → 세션 내
  1인1표 `unique(session_id,user_key,stage)` 그대로. **스키마 변경 불필요.**
- 가드: 생성·종료=`requireToss`, 입장·투표·조회=`requireAuth`. 익명은 세션 링크(uuid)로만 진입.
- ⚠️ 기능정의서 "앱인토스 식별 활용"은 **host 기준**으로 해석(참여자 익명) — 문서 문구 보정 필요.

## 1. 세션 상태 (정본)
```
collecting → aggregating → voting → closed
```
- 전환·마감 트리거 = **B 소유**. C는 `aggregating` 진입 시 `recommend()`가 호출됨.
- (구 B의 `voting_stage1 / listing / voting_stage2`는 폐기 — 위 enum으로 통일)

## 2. votes 스키마 (정본 — 컬럼형)
`supabase/migrations/0001_init.sql`의 votes 사용. EAV `(item,value)` 아님.
```
votes(session_id, user_key, stage,
      drink            text   check in (drinker|ok|uncomfortable),   -- stage1
      budget_min int, budget_max int,                                 -- stage1 (1인 범위, ₩)
      categories       jsonb,                                         -- stage1 (한글 분류 다중)
      mood             text   check in (quiet|any),                   -- stage1
      recommendation_id uuid)                                         -- stage2
```

## 3. B → C 입력 계약 (★ 정본: han 방식)
B가 stage1 votes를 집계해 아래 객체로 C에 넘긴다. **매핑·임계는 C가 보유**(아래 4).
```ts
interface AggregatedConstraints {
  drink: { drinker: number; ok: number; uncomfortable: number }; // 분포(인원수) — 범위/분포 보존
  budgetMin: number;          // 집계된 하한(소프트), ₩
  budgetMax: number;          // 집계된 상한(주력), ₩
  categories: { name: string; votes: number }[]; // 한글 분류 + 표수 (2표 임계는 C가 적용)
  moodDominant: 'quiet' | 'any' | null;          // 현재 가중치 0
}
interface Station { id: string; lat: number; lng: number; }
```
> 구 B의 "항목별 최빈값 `{item: topValue}`"는 **술 분포·예산 범위를 잃어 사용 불가.** 분포·범위를 보존해 넘길 것.

## 4. 소유 분담 (매핑·임계는 C)
| 변환/판정 | 소유 | 근거 |
|---|---|---|
| votes 원본 집계(분포·범위·표수 산출) | **B** | — |
| 술 분포 → 허용 place_type | **C** | domain/placeType |
| 예산 ₩ → priceLevel 밴드 | **C** | domain/budget |
| 카테고리 **2표 임계** 채택 | **C** | domain/category (CLAUDE.md "우리 소유") |
| 추천 선정·정렬·완화·longevity | **C** | domain/pipeline |
| 상태전환·stage1/2 집계·동점·Realtime | **B** | — |

## 5. C → B / 결과 (recommendations)
- C가 `recommendations`(place_id 참조 + rank/relaxed/place_type/review_count_at_agg/rating_at_agg) 작성.
- stage2 득표 집계·동점·최종 확정 = **B**. C 응답의 `voteCount`/`leader`는 표시용(집계 정본 아님).

## 6. 트리거 연결
- `aggregating` 진입 시 B → C `recommend(sessionId, AggregatedConstraints, Station)` 호출.
- 방식(내부 함수 호출 vs HTTP/DB 웹훅)은 B 합류 시 확정. C 진입점은 `services/recommend.ts:recommend()`.

## 7. 합류 대기 항목 (B 미구현 → 잠정)
- 신스택 B 집계(votes→AggregatedConstraints)·상태머신·Realtime: **K-yoon03 합류 후**.
- 그전까지 C는 `services/aggregation.ts`의 **중립 placeholder + WARN 로그**로 동작(그룹 제약 미반영 명시).
