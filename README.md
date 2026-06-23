# 냠냠투게더 백엔드 — A·C 파트 패키지

> 모임 식당 결정 서비스(앱인토스 미니앱)의 **추천 서버** 컨텍스트·스키마 패키지.
> 소유 범위: **A(테이블 설계 + RLS)** + **C(구글 Places + 추천 로직)**.
> B파트(세션 로직·RPC·Realtime)·CORS는 외부 소유 → 인터페이스로만 참조. 인증(토스 로그인)은 우리 잠정.

## 구성

```
CLAUDE.md                         # 전역 컨텍스트 + 소유 경계 + 병합 유의 (하네스 진입점)
docs/
├─ README.md                      # 문서 색인 + 핸드오프 요약
├─ db-schema.md                   # 전체 테이블 + RLS 설계
├─ domain-rules.md                # 추천 파이프라인(입력=집계된 제약)·정렬·longevity
├─ google-places-api.md           # 구글 Places 호출·SKU·ToS 캐싱(place_id만)
├─ api-spec.md                    # 우리 엔드포인트 + 외부 인터페이스
├─ openapi.yaml                   # 우리 엔드포인트 OpenAPI
└─ toss-login.md                  # 토스 로그인 → userKey (변경 없음, 소유 경계 협의 예정)
supabase/
└─ migrations/
   ├─ 0001_init.sql               # 테이블·제약·인덱스 (출시 전 클린 스키마)
   └─ 0002_rls.sql                # RLS (서버 게이트웨이 모델)
```

## 시작
1. `CLAUDE.md` §0(소유 경계·핸드오프·병합 유의)부터 읽는다.
2. `supabase/migrations/`를 적용(`supabase db push` 또는 SQL Editor).
3. `docs/README.md`의 구현 순서대로 진행.

## 데이터 보고 정할 것 (보류)
- priceLevel 밴드 경계(12k/25k/50k), `priceRange` 도입 여부, Nearby 반경(500m) — 시드 데이터 후 튜닝.

## B파트 미팅에서 확정할 것
- 인증 소유 경계, recommend 트리거 연결 방식(함수 호출 vs DB 웹훅/HTTP).
