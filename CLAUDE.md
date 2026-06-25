# CLAUDE.md — 냠냠투게더 백엔드 (Supabase Edge Function)

> Claude Code가 매번 참조하는 전역 컨텍스트. 코드 생성·수정 전 이 규칙을 우선 따른다.
> 이 레포는 냠냠투게더(앱인토스 미니앱)의 **백엔드 전체**다 — 인증·세션·투표·집계·추천·확정을 모두 소유한다.
> (초기엔 A·C/B 파트로 나눠 개발했으나, 현재는 한 레포(`api` 함수)로 통합됨.)

---

## 1. 프로젝트 개요

- **무엇**: 모임 참여자들의 취향(술·예산·음식·분위기·정렬)을 모아 **역 근처 식당 3~4곳으로 압축**해 투표·확정하게 하는 서비스의 백엔드.
- **핵심 철학**: **확정기가 아닌 압축기.** 후보를 좁혀줄 뿐 최종 선택은 사용자 투표.
- **AI 역할**: 선정·필터·정렬은 **전부 결정적 코드**. 외부 LLM·AI 추천 이유는 쓰지 않는다.
- **데이터 소스**: 구글 Places API(New) 단일 소스(카카오 등 폐기) + 점주/시민 등록 식당.

## 2. 기술 스택 (고정)

- **Supabase Edge Function (Deno)** — 단일 함수 `api`, **Hono** 라우터, basePath `/api`. `export default { fetch }`.
- **@supabase/supabase-js** — DB 접근 (★ ORM 금지). service_role로 서버에서 호출.
- **Supabase (PostgreSQL + RLS)** — DB.
- **구글 Places API(New)** — searchNearby / Place Details (서버만 호출, 키 보호).
- **토스 로그인(mTLS)** — `Deno.createHttpClient`로 인가코드 → userKey 교환. djwt/jsonwebtoken로 자체 JWT 발급.
- 배포: `supabase functions deploy api --project-ref <ref>` (config.toml `verify_jwt=false`).

## 3. 구조

```
supabase/
├─ config.toml                      # [functions.api] verify_jwt = false
├─ migrations/                      # 0001_init · 0002_rls · 0003 · 0004(winner_recommendation_id) · 0005(votes.sort_pref)
└─ functions/
   ├─ api/index.ts                  # 라우트(Hono) — auth·sessions·votes·recommendations·stations·places
   └─ _shared/
      ├─ auth.ts                    # requireAuth / requireToss / requireParticipant / JWT 발급
      ├─ supabase.ts                # service_role 클라이언트
      ├─ tossLogin.ts               # 토스 mTLS 인가코드 → userKey
      ├─ googlePlaces.ts            # searchNearby(카테고리 type 좁힘) / placeDetails(라이브) / 사진·한글 라벨
      ├─ aggregation.ts             # 집계 트리거: 정원 충족/마감 → aggregate(), 정렬 다수결 반영
      ├─ voteAggregation.ts         # stage1 표 → AggregatedConstraints + tallySortMode
      ├─ recommend.ts               # 후보 발굴(구글+등록) → 파이프라인 → recommendations 작성
      ├─ finalVote.ts               # stage2 최종 집계(winner/동점)
      ├─ database.types.ts
      └─ domain/                    # ★ 순수 함수 (외부 의존 X, 단위테스트 대상)
         ├─ placeType.ts            # 술 분포 → 허용 업종 필터
         ├─ budget.ts               # priceLevel 밴드 컷 + 저가 페널티
         ├─ category.ts             # 음식 카테고리 채택(1표↑) + 매칭 점수(+10) + 한글↔google type
         ├─ mood.ts                 # 분위기 점수(quiet일 때 시끄러운 업종 감점/조용한 가점)
         ├─ sort.ts                 # 정렬(리뷰수/평점/랜덤)
         ├─ longevity.ts            # 등록 식당 업력 가점
         └─ pipeline.ts             # 필터 → 점수 → 상위 10 통합
```

## 4. 상태 흐름

`collecting`(취향 수집) → `aggregating`(집계) → `voting`(후보 투표) → `closed`(확정)

- **집계 트리거**: ① 정원(`min_participants` = **최대 인원/정원, 호스트 포함**) 전원 stage1 응답 → 자동 집계, ② 마감 시각 경과(읽기 시 `checkDeadlineAndAggregate`).
- **호스트도 완전한 참여자**: 취향(stage1)·식당(stage2) 투표를 동일하게 한다. 진행 인원 집계에 포함.

## 5. 추천 로직 — ⚠️ AI 임의 변경 금지 (상세: `docs/domain-rules.md`)

1. **stage1 입력**: drink(술), budgetMin/Max, categories(음식), mood(분위기), **sortPref(정렬 기준 투표)**.
2. **집계(`voteAggregation`)**: 술 분포, budgetMax=전원 max의 25퍼센타일, 카테고리 표수, moodDominant, **정렬=다수결(동점→review_count)**.
3. **후보 발굴(`googlePlaces`)**: **채택 카테고리(1표↑)의 구글 type으로 searchNearby를 좁힘**(부족 시 전체로 보충) + 등록 식당 합류.
4. **필터(하드, `pipeline`)**: 술 업종 필터 → 예산 밴드 컷(priceLevel null은 통과) → 0개면 완화(예산→반경).
5. **점수(소프트)**: 카테고리 매칭 +10 · 분위기(quiet 시 ±) · 업력 가점 · 저가 페널티 −5 → 상위 10 저장.
6. **표시**: 상위 3~4곳, **세션 정렬(다수결 결정)** 적용, 라이브 구글 데이터(이름·한글업종·사진·평점·주소·지도) 부착.
7. **stage2/finalize**: 후보 투표 → 최다 득표 winner(동점 시 호스트 forceWinnerId).

## 6. 데이터 소스·ToS (`docs/google-places-api.md`)

- 구글 Places는 **서버만** 호출. searchNearby `languageCode=ko`, 최대 20개.
- **ToS: place_id만 영구 저장.** 이름·사진·평점 등은 라이브 조회 후 세션 내 사용·폐기.
- ❌ **Atmosphere 필드 금지**(`reviews` 본문·`servesXxx`·`goodForGroups` 등). "리뷰순"은 `userRatingCount`로. 사진(`photos`)은 허용(Pro).
- stale place_id: `CLOSED_PERMANENTLY` 비활성 / `movedPlaceId` 교체. 출처 표기 "Powered by Google".
- `places.source` ∈ google / owner / community 로 항상 구분.

## 7. 금지 사항

- ❌ 구글 Places 콘텐츠 DB 저장(place_id 제외) / Atmosphere 필드 요청.
- ❌ google·등록(owner/community) 데이터 혼동 — `source`로 구분.
- ❌ 외부 LLM·웹서치·AI 추천 이유 도입.
- ❌ ORM 도입 / 시크릿(구글 키·service_role·JWT_SECRET·mTLS 인증서) 하드코딩·커밋.
- ❌ 5장 추천 규칙 임의 변경 / Out of Scope(더치페이·푸시·AI 후기분석).

## 8. 운영·배포

- 배포 대상 프로젝트 ref는 `.env`의 `SUPABASE_URL` 기준(린크된 CLI 프로젝트와 다를 수 있으니 **`--project-ref` 명시**).
- 시크릿(GOOGLE_PLACES_API_KEY·JWT_SECRET·SUPABASE_SERVICE_ROLE_KEY·TOSS_MTLS_*)은 프로젝트에 설정.
- `auth/dev-login`은 `ENV=production`이면 404 — 실제 출시 전 `ENV=production` 시크릿 설정.
- CI/CD: `.github/workflows/` — push 시 테스트 + `supabase functions deploy`.

## 9. 커밋 규칙

- 커밋에 **Claude Co-Authored-By 트레일러 넣지 않는다.**
- 작성자는 `kkx7787 <kkx7787@naver.com>`.

## 10. 참고 문서 (docs/)
- `db-schema.md` — 테이블 + RLS
- `domain-rules.md` — 추천 파이프라인 상세
- `google-places-api.md` — 구글 Places 호출·ToS
- `api-spec.md` — 엔드포인트
- `toss-login.md` — 토스 mTLS 로그인 → userKey
