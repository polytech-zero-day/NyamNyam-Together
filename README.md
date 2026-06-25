# 냠냠투게더 백엔드 (Supabase Edge Function)

> 모임 참여자들의 취향(술·예산·음식·분위기·정렬)을 모아 **역 근처 식당 3~4곳으로 압축**해 투표·확정하는 앱인토스 미니앱의 **백엔드 전체**. **"확정기가 아니라 압축기."**
> 인증·세션·투표·집계·추천·확정을 **단일 Edge Function `api`** 가 모두 소유한다.

## 스택
- **Supabase Edge Function (Deno)** — 단일 함수 `api`, **Hono** 라우터, basePath `/api`, `export default { fetch }`.
- **@supabase/supabase-js** — DB 접근(service_role, ORM 금지).
- **Supabase (PostgreSQL + RLS)**.
- **구글 Places API(New)** — searchNearby / Place Details (서버만 호출, place_id만 영구 저장).
- **토스 로그인(mTLS)** — 인가코드 → userKey 교환 후 자체 JWT 발급(djwt).

## 구조
```
CLAUDE.md                       # 전역 컨텍스트(하네스 진입점)
docs/                           # 설계 문서 (db-schema·domain-rules·api-spec·google-places-api·toss-login·openapi)
supabase/
├─ config.toml                  # [functions.api] verify_jwt = false
├─ migrations/                  # 0001_init · 0002_rls · 0003 · 0004(winner_recommendation_id) · 0005(votes.sort_pref)
└─ functions/
   ├─ api/index.ts              # 라우트(Hono) — auth·sessions·votes·recommendations·stations·places
   └─ _shared/
      ├─ auth.ts                # requireAuth / requireToss / requireParticipant / JWT
      ├─ supabase.ts            # service_role 클라이언트
      ├─ tossLogin.ts           # 토스 mTLS 인가코드 → userKey
      ├─ googlePlaces.ts        # searchNearby(카테고리 type 좁힘) / placeDetails / 사진·한글 라벨
      ├─ aggregation.ts         # 집계 트리거(정원 충족/마감) + 정렬 다수결 반영
      ├─ voteAggregation.ts     # stage1 표 → AggregatedConstraints + tallySortMode
      ├─ recommend.ts           # 후보 발굴(구글+등록) → 파이프라인 → recommendations
      ├─ finalVote.ts           # stage2 최종 집계(winner/동점)
      └─ domain/                # 순수 함수(placeType·budget·category·mood·sort·longevity·pipeline) — 단위테스트 대상
```

## 상태 흐름
`collecting`(취향 수집) → `aggregating`(집계) → `voting`(후보 투표) → `closed`(확정)
- 집계 트리거: ① **정원(`min_participants`=최대 인원, 호스트 포함) 전원 stage1 응답** → 자동, ② 마감 경과(읽기 시 검사).
- **호스트도 완전한 참여자** — stage1·stage2 투표를 동일하게 한다.

## 개발 · 배포
```bash
supabase functions serve api          # 로컬
supabase functions deploy api --project-ref <ref>   # 배포(.env SUPABASE_URL 기준 ref 명시)
```
- 시크릿: `GOOGLE_PLACES_API_KEY` · `JWT_SECRET` · `SUPABASE_SERVICE_ROLE_KEY` · `TOSS_MTLS_*` (프로젝트에 설정, 커밋 금지).
- `auth/dev-login`은 `ENV=production`이면 404.
- CI/CD: `.github/workflows/` — `feat/edge-functions` 푸시 시 `supabase functions deploy api`.

## 문서 (docs/)
`CLAUDE.md`(규칙) → `docs/README.md`(색인) · `db-schema.md` · `domain-rules.md`(추천 로직 정본) · `api-spec.md` · `google-places-api.md` · `toss-login.md` · `openapi.yaml`.
