# Claude API — ai_reason 생성 (claude-api.md)

> `src/services/claude.ts` 구현 기준.
> 역할 축소: **추천 이유(ai_reason) 한 줄 생성 전용.** 웹서치·외부 출처·식당 선정 개입 없음.
> 선정(필터·정렬)은 전부 `src/domain/` 코드가 끝낸다.

## 역할 요약

```
입력: 파이프라인이 고른 최종 후보(최대 4) + 그룹 조건
      각 후보 구조화 데이터: { place_ref, name, types, primaryType,
                              priceLevel, rating, userRatingCount, distance_m }
      그룹 조건: { budgetBand, mood, categories[] }
역할: 각 후보에 "왜 이 그룹에 맞는지" 한 줄 ai_reason 생성
출력: JSON { reasons: [{ place_ref, reason }] }
```

> ❌ 웹서치 도구 사용 안 함. ❌ 외부 사이트(다이닝코드/식신/네이버 등) 참조 안 함.
> ❌ 후보 목록 밖 식당 언급 금지. ❌ 입력 데이터에 없는 사실 생성 금지.

## API 호출 설정

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 600,
  system: SYSTEM_PROMPT,                 // prompt caching 적용
  messages: [{ role: 'user', content: userPrompt }],
  // tools 없음 (web_search 미사용)
});
```

## 시스템 프롬프트 (SYSTEM_PROMPT)

```
너는 모임 식당 추천 문구 작성자야.
이미 코드가 그룹 조건으로 후보를 골라줬다. 너는 각 후보가 이 그룹에 왜 맞는지
한 줄(한국어, 25자 내외)로 설명만 한다.

## 핵심 규칙
- 입력으로 받은 구조화 데이터만 근거로 쓴다. 웹서치·외부 지식·추측 금지.
- 데이터에 없는 가격·메뉴·분위기를 지어내지 않는다.
- 후보 목록 밖 식당을 언급하지 않는다.
- 평점·리뷰 수는 표본이 적을 수 있으니 "평점 높음" 단정보다 "리뷰 N개" 같은 사실 위주로.

## 출력 형식 (JSON만, 다른 텍스트 없이)
{
  "reasons": [
    { "place_ref": "<입력의 place_ref 그대로>", "reason": "리뷰 많고 예산대 맞음" }
  ]
}
```

## 유저 프롬프트 템플릿

```typescript
const userPrompt = `
그룹 조건:
- 예산대: priceLevel ${budgetBand} 이하
- 분위기: ${mood === 'quiet' ? '조용한 선호' : '무관'}
- 음식: ${categories.join(', ')}

최종 후보:
${finalists.map(c =>
  `- place_ref: ${c.place_ref} | ${c.name} | ${c.primaryType} | ` +
  `priceLevel ${c.priceLevel ?? '?'} | rating ${c.rating ?? '?'} (${c.userRatingCount ?? 0}개) | ${c.distance_m ?? '?'}m`
).join('\n')}

각 후보에 한 줄 이유를 위 JSON 형식으로만 반환해줘.
`;
```

## 비용 관리

| 항목 | 값 |
|---|---|
| 모델 | claude-sonnet-4-6 |
| 입력/출력 단가 | $3 / $15 per 1M 토큰 |
| 세션 1회 예상 | 입력 ~800 / 출력 ~150 토큰 → 수 원 수준 |

- 후보 4개 이하라 입력이 작다. 웹서치 제거로 토큰·지연·비용 모두 감소.
- 시스템 프롬프트 캐싱으로 추가 절감.

## 에러 처리

```typescript
try {
  const text = response.content
    .filter(b => b.type === 'text').map(b => b.text).join('');
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  return new Map(parsed.reasons.map(r => [r.place_ref, r.reason]));
} catch {
  // 실패 시 ai_reason 없이 진행 (템플릿 폴백). 집계는 멈추지 않는다.
  return new Map();
}
```

## DB 저장 (recommendations.ai_reason)

- 파이프라인 결과 저장 시 place_ref로 매핑해 `recommendations.ai_reason`에 기록.
- reason이 없으면 null(또는 코드 템플릿: "예산·카테고리 부합"). low-confidence 개념 없음(웹서치 폐기).

## 환경변수
- `ANTHROPIC_API_KEY` (.env, git 제외)
