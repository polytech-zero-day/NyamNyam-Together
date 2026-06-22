// Claude API 연동 — 웹서치로 식당 조건 검증 + 추천 이유 생성 (claude-api.md)
// 카카오 목록 밖 식당은 절대 추천하지 않는다. 조건 판단 보조와 이유 생성만 담당.

import Anthropic from '@anthropic-ai/sdk';
import type { RestaurantRow } from '../domain/pipeline';

const client = new Anthropic(); // ANTHROPIC_API_KEY from env

const SYSTEM_PROMPT = `너는 그룹 모임 식당 필터링 전문가야.
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
- low: 확인 불가 → 최종 추천 제외 (반환하지 말 것)`;

export interface ClaudeRecommendation {
  kakao_id: string;
  place_name: string;
  reason: string | null;
  confidence: 'high' | 'medium' | null;
  source?: string | null;
  source_url?: string | null;
}

export interface GroupConditions {
  budget_max: number;
  mood: 'quiet' | 'any' | null;
  categories: string[];
}

export async function getClaudeRecommendations(
  candidates: RestaurantRow[],
  conditions: GroupConditions,
): Promise<ClaudeRecommendation[]> {
  if (candidates.length === 0) return [];

  const moodLabel = conditions.mood === 'quiet' ? '조용한' : '무관';
  const userPrompt = `
후보 식당 목록 (카카오 API 기반):
${candidates
  .map(
    (c) =>
      `- kakao_id: ${c.kakao_id} | ${c.name} | ${c.category_name} | ${c.distance_m ?? '?'}m | ${c.kakao_url ?? ''}`,
  )
  .join('\n')}

그룹 조건:
- 예산: 1인 ${conditions.budget_max}원 이하
- 분위기: ${moodLabel}
- 음식 카테고리: ${conditions.categories.join(', ')}

각 식당을 다이닝코드·식신에서 웹서치로 확인 후
조건에 맞는 3~4곳만 골라줘.
확인 안 된 곳은 제외하고, 확인된 곳만 JSON으로 반환해줘.
`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      // web_search_20260209: dynamic filtering variant, correct for claude-sonnet-4-6
      tools: [{ type: 'web_search_20260209' as const, name: 'web_search' }],
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const fullText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const clean = fullText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean) as {
      recommendations: Array<{
        kakao_id: string;
        place_name: string;
        reason: string;
        confidence: string;
        source?: string;
        source_url?: string;
      }>;
    };

    // confidence: low 제거 (DB CHECK: 'high'|'medium'|null 만 허용)
    return parsed.recommendations
      .filter((r) => r.confidence !== 'low')
      .map((r) => ({
        kakao_id: r.kakao_id,
        place_name: r.place_name,
        reason: r.reason ?? null,
        confidence: r.confidence === 'high' || r.confidence === 'medium' ? r.confidence : null,
        source: r.source ?? null,
        source_url: r.source_url ?? null,
      }));
  } catch {
    // 파싱 실패 시 카카오 accuracy 순서 상위 3개 반환, confidence: null
    return candidates.slice(0, 3).map((c) => ({
      kakao_id: c.kakao_id,
      place_name: c.name,
      reason: null,
      confidence: null,
    }));
  }
}

// ────────────────────────────────────────────────────────────
// 2단계 데이터 구축: 웹서치 보완 (kakao-api.md / db-schema.md 저장 원칙)
// 카카오가 안 주는 가격·분위기·평점을 다이닝코드·식신 웹서치로 확인해 restaurants 보완.
// ⚠️ 확인된 것만 저장. 추정값 금지. source_url 없으면 그 식당 보완 필드 전부 null.
// ────────────────────────────────────────────────────────────

const ENRICH_SYSTEM_PROMPT = `너는 식당 정보 조사 전문가야.
주어진 식당 목록을 웹서치로 조사해서 가격대·분위기·평점을 확인해줘.

## 핵심 규칙 (반드시 준수)
- 웹서치로 직접 확인된 정보만 반환. 추정·일반 상식 기반 값 절대 금지.
- "삼겹살집은 보통 2만원대" 같은 추론 금지.
- 확인 안 된 필드는 null.
- 출처(source_url)를 찾지 못하면 그 식당의 모든 보완 필드를 null로.

## 웹서치 참조 우선순위
1. 다이닝코드 (diningcode.com) — 가장 신뢰도 높음
2. 식신 (siksinhot.com) — 방문 빅데이터 기반
3. 카카오맵 리뷰
❌ 네이버 블로그 제외 (광고성)

## 반환 필드 (확인 안 되면 null)
- price_level: 1(저렴)~4(고가) 정수
- avg_price_min / avg_price_max: 1인 가격(원) 정수
- mood: ["조용한","룸있음"] 같은 한국어 분위기 키워드 배열
- source: "다이닝코드" / "식신" 등 출처명
- source_rating: 출처 평점(숫자)
- source_url: 확인 출처 URL

## 출력 형식 (JSON만, 다른 텍스트 없이)
{
  "enrichments": [
    {
      "kakao_id": "카카오 place id",
      "price_level": 2,
      "avg_price_min": 12000,
      "avg_price_max": 18000,
      "mood": ["조용한"],
      "source": "다이닝코드",
      "source_rating": 4.3,
      "source_url": "https://www.diningcode.com/..."
    }
  ]
}`;

export interface RestaurantEnrichmentInput {
  kakao_id: string;
  name: string;
  category_name: string;
  address?: string | null;
}

export interface RestaurantEnrichment {
  kakao_id: string;
  price_level: number | null;
  avg_price_min: number | null;
  avg_price_max: number | null;
  mood: string[] | null;
  source: string | null;
  source_rating: number | null;
  source_url: string | null;
}

// 웹서치 1회당 처리 식당 수 (토큰·시간 관리). 45개는 약 6배치.
const ENRICH_BATCH_SIZE = 8;

function nullEnrichment(kakao_id: string): RestaurantEnrichment {
  return {
    kakao_id,
    price_level: null,
    avg_price_min: null,
    avg_price_max: null,
    mood: null,
    source: null,
    source_rating: null,
    source_url: null,
  };
}

// 모델 응답을 DB 제약에 맞게 정규화. "확인된 것만" 원칙을 코드로 강제.
function normalizeEnrichment(raw: Record<string, unknown>): RestaurantEnrichment {
  const kakao_id = String(raw.kakao_id ?? '');

  // source_url 없으면 그 식당 보완 필드 전부 null (db-schema.md 저장 원칙)
  const sourceUrl =
    typeof raw.source_url === 'string' && raw.source_url.startsWith('http') ? raw.source_url : null;
  if (!sourceUrl) return nullEnrichment(kakao_id);

  const intOrNull = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;

  const priceLevelRaw = intOrNull(raw.price_level);
  const price_level =
    priceLevelRaw !== null && priceLevelRaw >= 1 && priceLevelRaw <= 4 ? priceLevelRaw : null;

  const mood =
    Array.isArray(raw.mood) && raw.mood.length > 0
      ? raw.mood.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      : null;

  return {
    kakao_id,
    price_level,
    avg_price_min: intOrNull(raw.avg_price_min),
    avg_price_max: intOrNull(raw.avg_price_max),
    mood: mood && mood.length > 0 ? mood : null,
    source: typeof raw.source === 'string' ? raw.source : null,
    source_rating:
      typeof raw.source_rating === 'number' && Number.isFinite(raw.source_rating)
        ? raw.source_rating
        : null,
    source_url: sourceUrl,
  };
}

async function enrichBatch(batch: RestaurantEnrichmentInput[]): Promise<RestaurantEnrichment[]> {
  const userPrompt = `다음 식당들을 웹서치로 조사해줘:
${batch
  .map((r) => `- kakao_id: ${r.kakao_id} | ${r.name} | ${r.category_name} | ${r.address ?? ''}`)
  .join('\n')}

각 식당을 다이닝코드·식신에서 확인해서 위 형식의 JSON으로 반환해줘.
확인 안 된 필드는 null로 두고, 출처를 못 찾으면 모든 필드를 null로 해줘.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      // web_search_20260209: dynamic filtering variant, correct for claude-sonnet-4-6
      tools: [{ type: 'web_search_20260209' as const, name: 'web_search' }],
      system: ENRICH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const fullText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const clean = fullText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean) as { enrichments?: Array<Record<string, unknown>> };

    const byId = new Map(
      (parsed.enrichments ?? []).map((e) => {
        const norm = normalizeEnrichment(e);
        return [norm.kakao_id, norm];
      }),
    );

    // 응답에 빠진 식당은 null 보완으로 채워 일관성 유지
    return batch.map((r) => byId.get(r.kakao_id) ?? nullEnrichment(r.kakao_id));
  } catch {
    // 배치 실패 시 전부 null 보완 (잘못된 데이터보다 null이 낫다)
    return batch.map((r) => nullEnrichment(r.kakao_id));
  }
}

/**
 * 식당 목록을 웹서치로 보완. 배치로 나눠 순차 호출.
 * 반환은 입력과 1:1 (확인 안 된 식당도 null 보완 포함).
 */
export async function enrichRestaurantsWithWebSearch(
  restaurants: RestaurantEnrichmentInput[],
): Promise<RestaurantEnrichment[]> {
  const results: RestaurantEnrichment[] = [];
  for (let i = 0; i < restaurants.length; i += ENRICH_BATCH_SIZE) {
    const batch = restaurants.slice(i, i + ENRICH_BATCH_SIZE);
    results.push(...(await enrichBatch(batch)));
  }
  return results;
}
