# 카카오 API & 캐싱 (kakao-api.md)

> 카카오 로컬 API는 **서버만** 호출(REST 키 보호). 출처: Kakao Developers 로컬 API.

## 사용 엔드포인트

- 카테고리 검색: `GET https://dapi.kakao.com/v2/local/search/category.json`
  - `category_group_code=FD6` (음식점), `x`, `y`, `radius`(m), `sort=accuracy`, `page`, `size`(최대 15)
- 키워드 검색: `GET https://dapi.kakao.com/v2/local/search/keyword.json`
- 헤더: `Authorization: KakaoAK {REST_API_KEY}` (.env, 절대 프론트 노출 금지)

## sort=accuracy 선택 이유

- `accuracy`: 카카오 자체 인기도·정확도 랭킹 기준 정렬 → **카카오가 검증한 상위 45개**
- `distance`: 단순 거리순 → 인기도 신호 없음
- **accuracy를 사용해야 한다.** 카카오 인기도 알고리즘(방문자 클릭 수·저장 수·정보 완성도 반영)을 무료로 활용하는 효과.

## 45개 제한 — 오히려 장점

카카오 API는 동일 검색어에 `pageable_count` 최대 45개 고정.
- total_count가 수백 개여도 상위 45개만 반환
- accuracy 정렬 기준이므로 폐업·정보 부실 식당은 이미 걸러진 상태
- 3페이지 × 15개 = 45개: Claude SQL 필터 → Claude API 최종 판단으로 이어지는 3단 깔때기의 첫 번째

```typescript
// 3페이지 순차 호출 — 최대 45개
for (let page = 1; page <= 3; page++) {
  const res = await kakaoClient.get('/search/category.json', {
    params: {
      category_group_code: 'FD6',
      x: lng,         // 카카오: x = 경도
      y: lat,         // 카카오: y = 위도
      radius: 500,    // 역 반경 500m 고정
      sort: 'accuracy',
      page,
      size: 15,
    },
  });
  if (res.data.meta.is_end) { ... break; }
}
```

## 카카오가 주는 것 / 안 주는 것

**주는 것 (restaurants 테이블 카카오 컬럼에 저장):**
- place_name, category_name, distance, x(경도), y(위도), place_url, address_name, phone, id

**안 주는 것 → Claude 웹서치로 보완 (restaurants 웹서치 컬럼):**
- 평점, 리뷰 수, 가격대, 영업시간, 메뉴, 분위기

## 캐싱 전략 (2단계)

### 1단계: 카카오 데이터 (Lazy TTL 30일)
```
recommend 요청 / 집계 시:
  meta = SELECT * FROM station_restaurants WHERE station_id = ?
  if (!meta || now - meta.kakao_fetched_at > 30일) {
    fresh = 카카오 호출(FD6, 역좌표, 반경 500m, 3페이지, accuracy)
    restaurants에 upsert (카카오 컬럼만)
    station_restaurants upsert (kakao_fetched_at 갱신)
  }
```

### 2단계: 웹서치 보완 (Lazy TTL 30일)
```
  if (!meta || now - meta.web_enriched_at > 30일) {
    Claude 웹서치로 각 식당 price_level·mood·source_rating 보완
    restaurants upsert (웹서치 컬럼만)
    station_restaurants upsert (web_enriched_at 갱신)
  }
```

### 사전 배치 (scripts/seed-restaurants.ts)
- 주요 역 5~10개는 배포 전 스크립트로 1·2단계 모두 사전 실행
- 서비스 코드에 포함하지 않음 (앱 심사 대상 아님)
- 데모용: 철산역, 신림역, 강남역, 홍대입구역, 건대입구역 등

## 호출 시점
- **집계 1회에 몰아서** 호출(종료 트리거 시). 수집·투표 단계엔 호출 안 함.
- 0개 완화 시 넓은 조건(반경 확대)으로 1회 재호출 가능.

## 응답 핵심 필드 (documents[])
- `id`: 카카오 place id (restaurants.kakao_id)
- `place_name`: 상호명
- `category_name`: "음식점 > 한식 > 육류,고기" (파이프라인 입력)
- `distance`: 역에서 거리(m)
- `x`: 경도, `y`: 위도
- `place_url`: 카카오맵 상세 URL
- `address_name`, `road_address_name`: 주소
- `phone`: 전화번호

## 환경변수 (.env, git 제외)
- `KAKAO_REST_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`(서버 전용), `SUPABASE_ANON_KEY`
- `TOSS_CLIENT_*` / mTLS 인증서 경로
- `ANTHROPIC_API_KEY`

## 사전 준비 (콘솔 담당과 공유)
- [ ] 카카오 개발자 앱 생성 + REST API 키 발급
- [ ] 카카오맵 API 사용 설정 ON
- [ ] 일/월 쿼터 확인
