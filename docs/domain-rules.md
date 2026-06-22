# 도메인 규칙 (domain-rules.md)

> 선정 로직의 단일 진실 공급원. `src/domain/`의 순수 함수로 구현하고 단위테스트한다.
> 프론트 CLAUDE.md 4장과 동일하게 유지. **LLM은 카카오 목록 밖의 식당을 선정에 개입하지 않는다.**

## 2단 파이프라인 (pipeline.ts)

```
입력: 집계된 제약(술/예산/음식/분위기) + restaurants 테이블 (station_id 기준)
1단계 필터형 (후보 풀 자르기)
   · 술 → 허용 장소타입 결정 후 필터
   · 예산 → restaurants.avg_price_min 기준 컷
             avg_price_min이 null이면 해당 식당 필터 미적용 (Claude 판단에 위임)
   · 위치 → 역 반경 내 (restaurants.station_id 기준)
2단계 선호형 (정렬)
   · 음식 카테고리 → 2표 이상 채택분 매칭 점수
   · 분위기 → restaurants.mood 기반 약한 가중치. null이면 가중치 0
   · source_rating → 다이닝코드·식신 기반. null이면 카카오 accuracy 정렬 순서 유지
출력: 상위 3~4곳 → Claude API에 넘겨 최종 선별 + ai_reason 생성
```

## 1. 술 수용도 → 장소타입 (placeType.ts)

입력: 참여자별 drink ∈ {drinker(①), ok(②), uncomfortable(③)}

| 조합 | 허용 장소타입 |
|---|---|
| ① 포함 & ③ 없음 | drink_required + compatible + general (전부) |
| ②만 / ①+② (③ 없음) | compatible + general (drink_required 제외) |
| ③ 1명이라도 | general 위주 |

장소타입 분류(가게 category_name 문자열 → place_type), **사람이 검수하는 룩업**:
- drink_required: 칵테일바, 와인바, LP바, 펍
- compatible: 포차, 고깃집, 이자카야, 호프, 곱창
- general: 한식·파스타·중식·분식 등
> category_name 예: "음식점 > 한식 > 육류,고기" → compatible. 표기 변형(주점/바 등) 보강 필요.

## 2. 예산 (budget.ts)

- 각 참여자 budget_min~budget_max. 집계는 **상한값들 중 낮은 쪽이 강하게**.
- 완전 최솟값은 후보 0개 위험 → **하위 25% 또는 (최솟값~중앙값) 사이**로 완충.
- 부드러운 필터: 가격대 컷이되 0개를 만들지 않는 방향.
- **restaurants.avg_price_min 기준으로 필터링** (DB에 저장된 웹서치 확인값).
- avg_price_min이 null인 식당 → 예산 필터 미적용, Claude API 최종 판단에 위임.
- ⚠️ category_name 기반 가격 추정은 avg_price_min/max가 둘 다 null일 때 보조 수단으로만 사용.

## 3. 음식 카테고리 (category.ts)

- 참여자 categories(jsonb) 합산 → **2표 이상 받은 카테고리만 채택**(합집합 폭발 방지).
- 채택 카테고리와 가게가 겹칠수록 높은 매칭 점수. 필터 아님(정렬용).
- 미선택 참여자는 무시(후보 풀 유지).

## 4. 분위기 (mood.ts)

- mood ∈ {quiet, any}. 거르지 않음. 평균 성향만 산출.
- **restaurants.mood 배열** 기반 가중치 계산. null이면 가중치 0.
- 동점 후보 간 순위 조정 가중치로만(약하게). 후순위 제약.

## 5. source_rating 정렬

- **restaurants.source_rating** (다이닝코드·식신 기반) 오름차순 정렬 보조.
- null이면 카카오 accuracy 정렬로 수집된 순서 유지 (카카오 자체 인기도 반영).
- source_rating 신뢰도: 다이닝코드 ≥ 식신 > null (카카오 순서)

## 6. 후보 0개 완화 (pipeline.ts)

- 완화 순서: 예산 완충폭 확대 → 음식 카테고리 완화 → 위치 반경 확대.
- **술 제약은 끝까지 유지**(③ 있는데 술집 추천 금지).
- 완화 적용 시 recommendations.relaxed=true → 화면 배너.

## 7. Claude API 최종 선별 (claude-api.md)

- 파이프라인 결과 상위 후보를 Claude API에 넘겨 최종 3~4곳 선별.
- Claude는 카카오 목록 밖의 식당을 추천하지 않는다.
- 웹서치로 확인 안 된 식당은 confidence: low → 최종 추천 제외.
- ai_reason: 각 추천 식당에 한 줄 이유 생성.

## 8. 수렴 (집계 아님, 화면+votes)

- 후보 = 세션당 1세트(모두 동일). 👍 = userKey별 1표(중복 방지).
- 최다 득표 자연 부상. 동점이면 억지 1등 안 만듦. 강한 "확정" 없음.

## 단위 테스트 원칙 (재현성 = 명세 슬라이드8 증거)
- 각 도메인 함수는 입력→출력 결정적(같은 입력 = 같은 출력).
- 술 조합 경계값, 예산 완충 경계, 2표 컷 경계, 0개 완화 순서를 테스트로 고정.
- null 처리 경계값 (avg_price_min=null, source_rating=null) 테스트 필수.
