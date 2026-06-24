# 백엔드 문서 (docs/) — A·C 파트 (추천 서버)

> Claude Code는 작업 영역 문서를 먼저 읽고 구현한다. 전역 규칙은 루트 `CLAUDE.md`.
> ⚠️ **소유 범위는 A(스키마+RLS) + C(구글 Places + 추천).** B파트(세션 로직·RPC·Realtime)·공통(인증·CORS)은 외부 소유 → 인터페이스로만 참조.

| 파일 | 내용 | 언제 읽나 | 소유 |
|---|---|---|---|
| `db-schema.md` | 전체 테이블 설계 + RLS | DB·마이그레이션·쿼리 | 우리(A) |
| `domain-rules.md` | 추천 파이프라인(입력=집계된 제약)·정렬·longevity | `src/domain/` | 우리(C) |
| `google-places-api.md` | 구글 Places 호출·SKU·ToS 캐싱(place_id만) | `services/googlePlaces` | 우리(C) |
| `api-spec.md` | 추천 조회·정렬·등록 + 외부 인터페이스 | `routes/` | 우리(C) |
| `toss-login.md` | 토스 로그인 → userKey (변경 없음) | 인증(`services/tossLogin`) | 우리(잠정) |

> 인증은 토스 로그인 그대로(변경 없음). 공통/B와의 소유 경계는 협의 예정 — 우리는 검증된 userKey를 소비.
> `kakao-api.md`는 폐기되고 `google-places-api.md`로 대체.

## 핸드오프 요약
```
B → 우리:  AggregatedConstraints + station
우리:       Nearby 라이브 → 파이프라인 → recommendations
우리 → B:  recommendations 행
트리거:    B 상태전환(collecting→aggregating)에서 우리 recommend 호출
```

## 구현 순서 (우리 범위)
1. DB 스키마 SQL (`supabase/migrations/`) — 전체 테이블 + RLS (restaurants→places 마이그레이션)
2. supabase 클라이언트 + 타입 생성
3. `src/domain/` 순수 함수 + 단위테스트 — placeType/budget/category/mood/sort/longevity/pipeline
4. `services/googlePlaces`(place_id 캐시) → `services/recommend`(파이프라인 호출)
5. `routes/` — recommend(조회·정렬), places(등록 스텁)

## 선행 작업 (콘솔 담당과 공유)
- GCP 프로젝트 + Places API(New) + 키(서버 IP 제한) + Enterprise 무료 한도(월 1,000) 모니터링
- 프론트 "Powered by Google" 출처 표기
- Supabase 프로젝트 + 키
- (인증·CORS는 공통 담당, B파트와 트리거/제약 인터페이스 합의)
