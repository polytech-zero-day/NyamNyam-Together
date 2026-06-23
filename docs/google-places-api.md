# 구글 Places API & 캐싱 (google-places-api.md)

> 구글 Places API(New)는 **서버만** 호출(키 보호). `src/services/googlePlaces.ts` 구현 기준.
> kakao-api.md를 대체한다. 카카오/웹서치 보완 로직은 전부 폐기.

## 사용 엔드포인트

- **Nearby Search (New)**: `POST https://places.googleapis.com/v1/places:searchNearby`
  - 집계 시 역 반경 내 음식점 후보 수집. **결과 최대 20개, 페이지네이션 없음**(카카오 45 → 20).
  - 기본 정렬 `rankPreference: POPULARITY`(카카오 accuracy 대응). 0개 완화 시 `radius` 확대.
- **Place Details (New)**: `GET https://places.googleapis.com/v1/places/{place_id}`
  - **최종 후보 3~4곳만** 표시용 라이브 조회에 사용(소수라 저렴). 전체 리스트엔 쓰지 않는다.
- 헤더: `X-Goog-Api-Key: {KEY}`, `X-Goog-FieldMask: ...`(아래)

## 과금 모델 — ★ 핵심

- 필드마스크에 든 필드 중 **가장 높은 티어 SKU 1개로만** 과금된다(합산 아님).
- 무료 한도(월): Essentials 10,000 / Pro 5,000 / **Enterprise 1,000** (SKU별, 풀링 안 됨).
- Nearby Search 1회 = 1건. seed 역 + 30일 탐색 주기 + 라이브 세션 규모면 무료 구간 안.

### 필드마스크 (Enterprise 단일 호출 고정)

```
# Nearby Search field mask (places. 접두어)
places.id,
places.displayName,
places.types,
places.primaryType,
places.location,
places.formattedAddress,
places.businessStatus,
places.openingDate,         # Pro (동승) — 단, 미래 개업 예정일 전용. 노포 과거 개업일 아님
places.rating,              # Enterprise (티어 결정)
places.userRatingCount,     # Enterprise
places.priceLevel           # Enterprise
# 선택: places.priceRange, places.regularOpeningHours (동일 Enterprise, 추가비용 0)
```

- Pro 필드(`types`,`primaryType`,`displayName`,`location`,`formattedAddress`,`businessStatus`,`openingDate`)는
  Enterprise 호출에 **추가 비용 0으로 동승**. 분위기·장소타입 추론은 전부 `types`/`primaryType`로 한다.
- ❌ **절대 넣지 않는다**(최고 티어 Ent+Atmosphere): `reviews`, `editorialSummary`, `generativeSummary`,
  `reviewSummary`, `servesBeer/Wine/...`, `goodForGroups`, `outdoorSeating`, `reservable` 등.

> `openingDate`는 받되 longevity 용도로 신뢰하지 말 것 — 구글은 **미래 개업 예정**에만 채워준다.
> 운영 연차 신호는 등록(owner) 경로의 `open_date`에서만 가져온다(domain-rules.md 9).

## ToS 캐싱 — ★ place_id만 영구, 그 외 라이브

```
저장 가능(영구): place_id  ← ToS 캐싱 면제 필드
저장 금지: 이름·평점·리뷰수·가격·타입 등 모든 구글 콘텐츠
           → 집계/표시 시점에 라이브 조회 후 세션 내에서만 사용하고 버린다 (30일 캐시도 안 함)
```

- DB(`places`, `station_places`)에는 **place_id + 우리 가공/등록 데이터**만 둔다. 콘텐츠 컬럼 없음.
- stale place_id: 라이브 조회 결과가 `CLOSED_PERMANENTLY`면 비활성, `movedPlace/movedPlaceId` 오면 새 id로 교체.
- 출처 표기: 지도 없이 평점 등 노출 시 **"Powered by Google" 출처 표기**(프론트 필수).

## 캐싱 전략 (place_id 디스커버리)

```
[집계 시점]
  meta = SELECT * FROM station_places WHERE station_id = ?
  if (!meta || now - meta.places_discovered_at > 30일) {
    fresh = Nearby Search(역좌표, radius, POPULARITY, Enterprise 필드마스크)  ← 라이브
    places upsert (source='google', google_place_id, station_id 만)          ← 콘텐츠 저장 안 함
    station_places upsert (places_discovered_at 갱신)
  }
  # fresh(라이브 응답)를 파이프라인 입력으로 그대로 사용 (DB 재조회 아님)
```

- place_id는 **만료·삭제하지 않는다.** 30일 TTL은 "역을 다시 Nearby로 탐색하는 주기"에만 적용.
- 등록(owner/community) 식당은 디스커버리 대상 아님. `places`에 first-party로 들어가 파이프라인에 합류.

## 사전 배치 (scripts/seed-places.ts)

- 주요 역 5~10개를 배포 전 Nearby Search로 **place_id만** 미리 적재(콘텐츠 창고 아님 = "id 워밍").
- 서비스 코드 아님, 배포 안 함. 데모용 역: 강남역, 홍대입구역, 건대입구역, 신림역, 철산역.

## 호출 시점

- Nearby Search: **집계 1회에 몰아서**. 수집·투표 단계엔 호출 안 함. 0개 완화 시 반경 확대 1회 재호출.
- Place Details: voting 화면에서 **최종 후보 3~4곳 표시용**으로만(또는 집계 응답을 세션에 전달해 재사용).

## 음식점 타입 (Nearby includedPrimaryTypes)

- 카테고리 검색은 `includedPrimaryTypes`로 음식점군 한정(예: `restaurant` + 세부 `korean_restaurant` 등).
- 한글 분류 ↔ google types 매핑은 domain-rules.md 3장 표를 단일 출처로 사용.

## 환경변수 (.env, git 제외)
- `GOOGLE_PLACES_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`(서버 전용), `SUPABASE_ANON_KEY`
- `TOSS_CLIENT_*` / mTLS 인증서 경로

## 사전 준비 (콘솔 담당과 공유)
- [ ] GCP 프로젝트 + Places API(New) 사용 설정
- [ ] API 키 발급 + **서버 IP/HTTP 리퍼러 제한**
- [ ] 결제 계정 연결 + Enterprise SKU 무료 한도(월 1,000) 모니터링 알림
- [ ] 프론트 "Powered by Google" 출처 표기 반영
