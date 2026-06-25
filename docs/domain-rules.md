# 도메인 규칙 (domain-rules.md)

> 추천 선정 로직의 단일 진실 공급원. `supabase/functions/_shared/{domain,recommend,aggregation,voteAggregation}` 으로 구현·테스트한다.
> 입력은 **참여자들의 stage1 원본 투표** — 집계부터 추천까지 모두 이 백엔드가 소유한다.

## 0. 입력 — stage1 투표 (참여자·호스트 동일)

```ts
interface Stage1Vote {
  drink: 'drinker' | 'ok' | 'uncomfortable';
  budget_min: number | null;
  budget_max: number | null;
  categories: string[];                 // 한글 음식 분류 (복수)
  mood: 'quiet' | 'any' | null;
  sort_pref: 'review_count' | 'rating' | 'random' | null; // 정렬 기준 투표
}
```

## 1. 집계 (voteAggregation.ts → AggregatedConstraints)

- **drink 분포**: {drinker, ok, uncomfortable} 카운트.
- **budgetMax = 전원 max의 25퍼센타일**(빠듯한 쪽으로 보수적). **budgetMin = 전원 최저값.**
- **categories**: {name, votes} 표수 집계.
- **moodDominant**: quiet 비율 > 50% 면 `quiet`, 아니면 `any`.
- **정렬(tallySortMode)**: sort_pref **다수결**로 1개 결정 → `session.sort_mode`. **동점·무응답 → `review_count`.**

집계 트리거(aggregation.ts): ① 정원(`min_participants`=최대 인원, 호스트 포함) 전원 응답 → 자동, ② 마감 시각 경과.

## 2. 후보 발굴 (recommend.ts + googlePlaces.ts) — ★ 카테고리로 검색을 좁힘

- **채택 카테고리(1표↑)의 google type을 `searchNearby`의 `includedPrimaryTypes`로** 전달 → 취향 음식 위주로 후보 수집(역 반경 500m, 인기순, 최대 20).
- 좁혀서 **후보 < 6이면 전체 `restaurant` 검색으로 보충**(매칭 후보는 점수로 우선).
- 등록 식당(owner/community)도 후보 합류.
- 후보 풀 = [구글 라이브] ∪ [등록 식당].

## 3. 술 → 업종 필터 (placeType.ts) — 하드 컷

| 술 분포 | 허용 place_type |
|---|---|
| uncomfortable ≥ 1 | **general만** |
| drinker > 0, ok = 0 | drink_required + compatible + general |
| 그 외(ok 포함, uncomfortable=0) | compatible + general |

**google types → place_type:** drink_required = `bar`/`pub`/`wine_bar`/`night_club` · compatible = `barbecue_restaurant`/`brewery`/`bar_and_grill` · general = 그 외.

## 4. 예산 (budget.ts) — max 주력 하드, min 소프트

| 금액(원) | priceLevel band |
|---|---|
| < 12,000 | 1 |
| < 25,000 | 2 |
| < 50,000 | 3 |
| ≥ 50,000 | 4 |

- **max → 상한 하드 필터**: `priceLevel ≤ bandOf(budgetMax)`. **priceLevel null이면 통과**(구글이 가격 미제공 케이스 다수).
- **min → 소프트 페널티**: priceLevel이 bandOf(budgetMin)보다 낮으면 점수 **−5**(필터 아님).

## 5. 음식 카테고리 (category.ts) — 1표 채택 + 매칭 가점

- **1표 이상 받은 카테고리 모두 채택**(`MIN_CATEGORY_VOTES = 1`). 소규모 모임에서 취향이 갈려도 전부 반영. (아무도 안 골랐으면 빈 배열.)
- 채택 카테고리와 식당 google `types`가 겹치면 **+10점/카테고리**(`scoreByCategoryMatch`). 검색 좁힘(2장) + 이 가점의 이중 반영.
- 채택 카테고리의 google type은 **검색(`includedPrimaryTypes`)에도** 쓰인다.

**한글 분류 ↔ google types:**

| 한글 | google types |
|---|---|
| 한식 | korean_restaurant |
| 일식 | japanese_restaurant, sushi_restaurant, ramen_restaurant |
| 양식 | italian_restaurant, american_restaurant, french_restaurant, steak_house, pizza_restaurant, hamburger_restaurant, spanish_restaurant |
| 중식 | chinese_restaurant |
| 분식 | korean_restaurant (전용 type 없음 → 한식 fallback) |
| 아시안 | asian_restaurant, thai_restaurant, vietnamese_restaurant, indian_restaurant, indonesian_restaurant, middle_eastern_restaurant |
| 고기·구이 | barbecue_restaurant, korean_restaurant |
| 카페·브런치 | cafe, coffee_shop, bakery, brunch_restaurant, breakfast_restaurant, dessert_restaurant |

> ⚠️ 카테고리별 **쿼터(균등 분배)는 없음** — 상위 N은 점수·리뷰순이라 인기 많은 한 음식이 칸을 다 차지할 수 있다.

## 6. 분위기 (mood.ts) — types 기반 점수 (moodDominant=quiet 일 때만)

구글에 소음 필드가 없어 **types/primaryType를 대리 신호**로 사용. quiet일 때만 동작(any/null → 0):

| 업종 | 점수 |
|---|---|
| 시끄러운(bar/pub/night_club/karaoke) | **−8** |
| 경계(bar_and_grill/brewery/wine_bar) | **−3** |
| 조용한(cafe/coffee_shop/tea_house/bakery/fine_dining/book_store) | **+3** |
| 그 외 | 0 |

> 음식 매칭(+10)보다 작게 두어 음식 선호가 우선, 분위기는 동점·근소차에서만 순위 변경.

## 7. 점수 합산 & 정렬

- **점수**(scoreCandidate) = 카테고리 매칭(+10/개) + 업력(longevity) + 분위기(±) − 저가 페널티(−5). 동점 시 리뷰수 → 거리.
- **상위 10곳 저장**(STORE_COUNT). 표시는 상위 3~4곳.
- **표시 정렬(sort_mode, 다수결 결정)**: `review_count`(리뷰 많은 순, 기본) / `rating`(평점순, 표본 적으면 신뢰 하향) / `random`(sort_seed 기반 결정적 셔플 — 새로고침해도 고정, 균등 분배 아님).

## 8. longevity (longevity.ts)
- 등록(owner) 식당 `open_date` 기반 **약한 가점**(연 +0.5, 상한). 구글 식당·없음은 0.

## 9. 후보 0개 완화 (pipeline.ts)
- 순서: **예산 완화 → 반경 확대(1km 재검색)**. 술 제약은 끝까지 유지. `relaxed=true` → 화면 배너.

## 10. stage2 / finalize (finalVote.ts)
- 후보 중 1곳 투표. **최다 득표가 winner**, 동점 시 호스트 `forceWinnerId`로 결정. `winner_recommendation_id` 저장 + `closed`.

## 단위 테스트 원칙
입력→출력 결정적. 술 경계 / priceLevel 밴드 / 카테고리 채택·매칭 / 분위기 점수 / 정렬 다수결·동점 / random 시드 재현성 / null 처리(priceLevel·rating·open_date) 테스트.
