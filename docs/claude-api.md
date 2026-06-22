# Claude API & 웹서치 연동 (claude-api.md)

> `src/services/claude.ts` 구현 기준.
> Claude API는 카카오 목록 밖의 식당을 생성하지 않는다. 조건 판단 보조와 추천 이유 생성만 담당.

## 역할 요약

```
입력: 카카오 목록에서 SQL 1차 필터된 후보 (최대 15개)
      + 그룹 조건 (예산, 분위기, 음식 카테고리)
역할 1: 웹서치로 각 식당 실제 정보 확인 후 조건 부합 여부 판단
역할 2: 최종 3~4곳 선별
역할 3: 각 식당 ai_reason 한 줄 생성
출력: JSON { recommendations: [{ kakao_id, reason, confidence }] }
```

## API 호출 설정

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1000,
  tools: [
    {
      // 동적 필터링 변형 — claude-sonnet-4-6 기준. SDK가 지원하는 최신 web_search 도구.
      type: 'web_search_20260209',
      name: 'web_search',
    },
  ],
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: userPrompt }],
});
```

## 시스템 프롬프트 (SYSTEM_PROMPT)

```
너는 그룹 모임 식당 필터링 전문가야.
카카오 API로 수집한 식당 후보 목록에서 그룹 조건에 맞는 곳을 골라줘.

## 핵심 규칙
- 반드시 주어진 후보 목록 안에서만 선택 (목록 밖 식당 추천 절대 금지)
- 웹서치로 직접 확인된 정보만 판단 근거로 사용
- 확인 안 된 식당은 confidence: "low" 처리
- "삼겹살집은 보통 2만원대" 같은 일반 상식 추론 금지

## 웹서치 참조 우선순위
1. 다이닝코드 (diningcode.com) — 가장 신뢰도 높음
2. 식신 (siksinhot.com) — 방문 빅데이터 기반
3. 카카오맵 리뷰
❌ 네이버 블로그 제외 (광고성)

## 출력 형식 (JSON만, 다른 텍스트 없이)
{
  "recommendations": [
    {
      "kakao_id": "카카오 place id",
      "place_name": "식당명",
      "reason": "예산 1.5만원대, 룸 있어 조용함 (출처: 다이닝코드)",
      "confidence": "high",
      "source": "다이닝코드",
      "source_url": "https://..."
    }
  ]
}

## confidence 기준
- high: 웹서치로 가격·분위기 직접 확인
- medium: 부분 확인 (가격 또는 분위기 중 하나만)
- low: 확인 불가 → 최종 추천 제외 (반환하지 말 것)
```

## 유저 프롬프트 템플릿

```typescript
const userPrompt = `
후보 식당 목록 (카카오 API 기반):
${candidates.map(c =>
  `- kakao_id: ${c.kakao_id} | ${c.name} | ${c.category_name} | ${c.distance_m}m | ${c.kakao_url}`
).join('\n')}

그룹 조건:
- 예산: 1인 ${budget_max}원 이하
- 분위기: ${mood === 'quiet' ? '조용한' : '무관'}
- 음식 카테고리: ${categories.join(', ')}

각 식당을 다이닝코드·식신에서 웹서치로 확인 후
조건에 맞는 3~4곳만 골라줘.
확인 안 된 곳은 제외하고, 확인된 곳만 JSON으로 반환해줘.
`;
```

## 비용 관리

| 항목 | 값 |
|---|---|
| 모델 | claude-sonnet-4-6 |
| 입력 단가 | $3 / 1M 토큰 |
| 출력 단가 | $15 / 1M 토큰 |
| 세션 1회 예상 입력 | ~3,300 토큰 |
| 세션 1회 예상 출력 | ~500 토큰 |
| 세션 1회 예상 비용 | ~$0.027 (약 40원) |

**비용 절감:**
- 시스템 프롬프트 캐싱 → 최대 90% 절감
- 후보를 15개 이하로 유지 (SQL 1차 필터 철저히)

## 환경변수
- `ANTHROPIC_API_KEY` (.env, git 제외)

## 에러 처리

```typescript
try {
  const fullText = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  const clean = fullText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  // confidence: low 제거
  const filtered = parsed.recommendations.filter(
    r => r.confidence !== 'low'
  );

  return filtered;
} catch (err) {
  // Claude 응답 파싱 실패 시 → 카카오 accuracy 순서로 상위 3개 반환
  return candidates.slice(0, 3).map(c => ({
    kakao_id: c.kakao_id,
    place_name: c.name,
    reason: null,
    confidence: 'low',
  }));
}
```

## DB 저장 (recommendations 테이블)

```typescript
const rows = filtered.map((r, idx) => ({
  session_id: sessionId,
  restaurant_id: restaurantIdMap[r.kakao_id], // restaurants.id 매핑
  name: r.place_name,
  ai_reason: r.reason,
  confidence: r.confidence,
  rank: idx + 1,
  // 나머지 컬럼은 restaurants JOIN으로
}));

await supabase.from('recommendations').insert(rows);
```
