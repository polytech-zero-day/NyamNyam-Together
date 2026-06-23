# 도메인 규칙 (domain-rules.md)

> 추천 선정 로직의 단일 진실 공급원. `src/domain/`의 순수 함수로 구현·테스트한다.
> ⚠️ **이 파이프라인은 "이미 집계된 제약"을 입력으로 받는다.** votes 원본 집계(예산 종합·다수결·표수)는 **B파트** 소유다.

## 0. 입력 계약 (B → 우리)

```ts
// B파트 1단계 집계 결과 + 세션 위치
interface AggregatedConstraints {
  drink: { drinker: number; ok: number; uncomfortable: number }; // 분포(인원수)
  budgetMin: number;          // 집계된 하한 (소프트)
  budgetMax: number;          // 집계된 상한 (주력)
  categories: { name: string; votes: number }[]; // 한글 분류 + 표수
  moodDominant: 'quiet' | 'any' | null;
}
interface Station { id: string; lat: number; lng: number; }
```

출력: `recommendations` 행(상위 3~10). 이후 stage2 투표·동점·상태전환은 B.

## 2단 파이프라인 (pipeline.ts)

```
입력: AggregatedConstraints + 후보 풀
      후보 = [구글 Nearby 라이브 결과] ∪ [places의 owner/community 등록 식당]
1단계 필터형:  술 분포 → 허용 장소타입 필터 / 예산 밴드 컷 / 역 반경
2단계 선호형:  카테고리 2표 매칭 점수 / 평점 신호 / longevity
출력: 상위 3~4곳 → recommendations 작성 (선정·정렬 전부 코드)
```

## 1. 술 수용도 → 장소타입 (placeType.ts)

drink 분포로 허용 집합 결정(인원수 기준):

| 조합 | 허용 장소타입 |
|---|---|
| uncomfortable ≥ 1 | general 위주 |
| drinker만 (ok·uncomfortable=0) | drink_required + compatible + general |
| 그 외(ok 포함, uncomfortable=0) | compatible + general |

**google `types`/`primaryType` → place_type (enum 매핑):**
- drink_required: `bar`, `pub`, `wine_bar`, `night_club`
- compatible: `barbecue_restaurant`, `brewery`, `bar_and_grill` (한식 고깃집/포차는 보강 룩업)
- general: 그 외 `*_restaurant`, `cafe`, `bakery`, `coffee_shop`, `restaurant`

> 등록 식당은 등록 분류로 place_type 직접 지정. 매핑 테이블은 사람이 검수.

## 2. 예산 (budget.ts) — 범위 입력, max 주력·min 소프트

- 입력 `budgetMin~budgetMax`(집계값). 구글은 **priceLevel(1~4)** 만 → 밴드로 환산:

| 금액(원) | priceLevel |
|---|---|
| < 12,000 | 1 |
| < 25,000 | 2 |
| < 50,000 | 3 |
| ≥ 50,000 | 4 |

- **max → 허용 상한(주력 필터)**, P25 완충으로 0개 위험 방지.
- **min → 하한(소프트)**: 하드 필터 아님. min 밴드 미만은 정렬에서 약하게 후순위(감점). 0개 위험 시 가장 먼저 푼다.
- 통과 조건: `priceLevel ∈ [bandOf(min)…bandOf(max)]`, 단 하한은 소프트.
- **priceLevel null → 예산 필터 미적용(통과).**
- (선택) `priceRange`(원 단위, 동일 Enterprise)는 **한국 커버리지 확인 후** 정밀화. 미도입 시 밴드 기준.
- 등록 식당은 점주 신고 price_level 사용.

## 3. 음식 카테고리 (category.ts) — ★ 2표 임계는 우리 소유

- B가 넘긴 `categories(name, votes)`에서 **2표 이상만 채택**(합집합 폭발 방지). 임계 판단은 추천 로직(우리).
- 채택 카테고리와 식당 google `types`가 겹칠수록 높은 매칭 점수. **필터 아님(정렬용).**

**한글 분류 ↔ google types:**

| 한글 분류 | google types (매칭/includedPrimaryTypes) |
|---|---|
| 한식 | korean_restaurant |
| 고기·구이 | barbecue_restaurant, korean_restaurant |
| 일식 | japanese_restaurant, sushi_restaurant, ramen_restaurant |
| 중식 | chinese_restaurant |
| 양식·파스타 | italian_restaurant, american_restaurant, french_restaurant, steak_house |
| 분식 | korean_restaurant (전용 type 없음 → fallback) |
| 치킨 | chicken_restaurant, fast_food_restaurant |
| 술집 | bar, pub, wine_bar |
| 카페·디저트 | cafe, coffee_shop, bakery, dessert_restaurant |

## 4. 분위기 (mood.ts) — 현재 미사용

- Atmosphere 필드(goodForGroups 등)는 최고 티어라 안 받음 → 신뢰할 신호 없음.
- **현재 가중치 0(사실상 미사용).** moodDominant는 받되 정렬에 영향 주지 않음(추후 등록 데이터로 보강 시 재도입).

## 5. 평점 신호 & 정렬 (sort.ts)

- 신호: 구글 `userRatingCount`(리뷰 수) 우선 + `rating` 보조. 등록 식당은 null 가능.
- **표본 보정**: 리뷰 적으면 rating 신뢰 하향(리뷰 3개 4.9 ≠ 신뢰). 기본 신호는 리뷰 수.
- **정렬(sort_mode, 세션 공유):**
  - `review_count`(기본): userRatingCount 내림차순. null/등록식당 후순위(감점 아님, 배지 구분).
  - `rating`: rating 내림차순, **단 userRatingCount ≥ MIN(예: 10) 미만 신뢰 하향**.
  - `random`: session.sort_seed 기반 결정적 셔플(새로고침해도 고정).
- 정렬은 **표시 순서만** 바꾼다(후보·집계 불변). 기본값은 객관 신호(리뷰 수)로 — 정렬=약한 추천(앵커링)임을 인지.

## 6. longevity (longevity.ts)

- **출처는 등록(owner) 식당 `open_date`뿐.** 구글 `openingDate`는 미래 개업 전용이라 google 식당엔 적용 안 함.
- 오래 운영 = 상권 생존의 방증 → 등록 식당에 **약한 가점**. open_date 없으면 0(감점 아님).

## 7. 후보 0개 완화 (pipeline.ts)

- 완화 순서: **예산(min 하한 먼저)** → 카테고리 → 반경(Nearby radius 확대 1회 재호출).
- 술 제약은 끝까지 유지. relaxed=true → 화면 배너.

## 단위 테스트 원칙
- 입력→출력 결정적. 술 분포 경계, priceLevel 밴드 경계, min 소프트/max 필터, 2표 컷, 완화 순서, random 시드 재현성, 표본보정 경계, null 처리(priceLevel/rating/userRatingCount/open_date) 테스트 필수.

> **범위 밖**: votes 원본 집계(예산 종합·다수결), 상태전환, stage2 동점 처리는 B파트. 이 문서에서 구현하지 않는다.
