# 백엔드 문서 (docs/)

> 냠냠투게더 백엔드(Supabase Edge Function `api`)의 설계 문서. 전역 규칙은 루트 `CLAUDE.md`.
> 이 레포는 백엔드 **전체**(인증·세션·투표·집계·추천·확정)를 소유한다.

| 파일 | 내용 |
|---|---|
| `db-schema.md` | 테이블 6종 + RLS (sessions/participants/votes/recommendations/places/station_places) |
| `domain-rules.md` | 추천 파이프라인(입력→집계→발굴→필터→점수→표시) + 정렬 다수결 |
| `google-places-api.md` | 구글 Places(New) 호출·필드마스크·ToS(place_id만 저장) |
| `api-spec.md` | `api` 함수 엔드포인트(auth/sessions/votes/recommendations/stations/places) |
| `toss-login.md` | 토스 mTLS 로그인 → userKey → 자체 JWT |
| `integration-contract.md` | 프론트↔백엔드 계약(요청/응답 DTO) |
| `openapi.yaml` | OpenAPI 스펙 |
| `privacy.html` / `terms.html` / `index.html` | 약관·개인정보 정적 페이지(GitHub Pages) |

## 흐름 요약
```
참여자/호스트 stage1(취향+정렬) → 정원 충족/마감 → aggregate
  → 구글 Places(카테고리로 좁힌 검색) + 등록식당 → 파이프라인 → recommendations
  → stage2 후보 투표 → finalize(winner)
```

## 단일 함수 구조
- 라우트: `supabase/functions/api/index.ts` (Hono)
- 서비스/도메인: `supabase/functions/_shared/*`
- 마이그레이션: `supabase/migrations/*`

배포: `supabase functions deploy api --project-ref <ref>`
