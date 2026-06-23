// Claude API — ai_reason 한 줄 생성 전용 (claude-api.md)
// ❌ 웹서치·외부 출처·식당 선정 개입 없음. 선정(필터·정렬)은 src/domain/이 끝낸다.
// 실패 시 빈 Map 반환 → 호출측 템플릿 폴백. 집계는 멈추지 않는다.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // ANTHROPIC_API_KEY from env

const SYSTEM_PROMPT = `너는 모임 식당 추천 문구 작성자야.
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
}`;

export interface ReasonFinalist {
  place_ref: string;
  name: string | null;
  primaryType: string | null;
  priceLevel: number | null;
  rating: number | null;
  userRatingCount: number | null;
  distanceM: number | null;
}

export interface ReasonGroup {
  budgetBand: number;
  mood: 'quiet' | 'any' | null;
  categories: string[];
}

/**
 * 최종 후보에 대한 ai_reason 한 줄 생성.
 * @returns place_ref → reason. 실패 시 빈 Map (호출측에서 템플릿 폴백).
 */
export async function generateReasons(
  finalists: ReasonFinalist[],
  group: ReasonGroup,
): Promise<Map<string, string>> {
  if (finalists.length === 0) return new Map();

  const userPrompt = `
그룹 조건:
- 예산대: priceLevel ${group.budgetBand} 이하
- 분위기: ${group.mood === 'quiet' ? '조용한 선호' : '무관'}
- 음식: ${group.categories.join(', ') || '무관'}

최종 후보:
${finalists
  .map(
    (c) =>
      `- place_ref: ${c.place_ref} | ${c.name ?? '?'} | ${c.primaryType ?? '?'} | ` +
      `priceLevel ${c.priceLevel ?? '?'} | rating ${c.rating ?? '?'} (${c.userRatingCount ?? 0}개) | ${c.distanceM ?? '?'}m`,
  )
  .join('\n')}

각 후보에 한 줄 이유를 위 JSON 형식으로만 반환해줘.
`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: SYSTEM_PROMPT, // prompt caching 적용 대상
      messages: [{ role: 'user', content: userPrompt }],
      // tools 없음 (web_search 미사용)
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as {
      reasons: Array<{ place_ref: string; reason: string }>;
    };
    return new Map(parsed.reasons.map((r) => [r.place_ref, r.reason]));
  } catch {
    // 실패 시 ai_reason 없이 진행 (템플릿 폴백). 집계는 멈추지 않는다.
    return new Map();
  }
}
