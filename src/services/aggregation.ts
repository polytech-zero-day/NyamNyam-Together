// 종료 트리거 + 집계 서비스
// collecting → aggregating → voting 상태 전환.
// 파이프라인 결과 → Claude 웹서치 검증 → recommendations 테이블 저장.

import { supabase } from '../config/supabase';
import { getOrFetchRestaurants, enrichStationRestaurants } from './kakao';
import { getClaudeRecommendations } from './claude';
import { runPipeline, Stage1Response, RecommendedPlace } from '../domain/pipeline';
import { computeBudgetCap } from '../domain/budget';
import { getEligibleCategories } from '../domain/category';
import { computeQuietRatio } from '../domain/mood';
import type { DrinkValue, MoodValue } from '../types/database.types';

async function getStage1Responses(sessionId: string): Promise<Stage1Response[]> {
  const { data, error } = await supabase
    .from('votes')
    .select('user_key, drink, budget_min, budget_max, categories, mood')
    .eq('session_id', sessionId)
    .eq('stage', 1);

  if (error) throw error;
  if (!data?.length) return [];

  return data.map((row) => ({
    drink: (row.drink as DrinkValue) ?? 'ok',
    budget_min: (row.budget_min as number) ?? 0,
    budget_max: (row.budget_max as number) ?? 0,
    categories: Array.isArray(row.categories) ? (row.categories as string[]) : [],
    mood: (row.mood as MoodValue) ?? null,
  }));
}

async function storeRecommendations(
  sessionId: string,
  recommended: RecommendedPlace[],
  claudeResults: Awaited<ReturnType<typeof getClaudeRecommendations>>,
): Promise<void> {
  if (recommended.length === 0) return;

  const claudeMap = new Map(claudeResults.map((r) => [r.kakao_id, r]));

  const rows = recommended.map((p, idx) => {
    const claude = claudeMap.get(p.kakao_id);
    return {
      session_id: sessionId,
      restaurant_id: p.id,
      name: p.name,
      category_name: p.category_name,
      place_type: p.place_type,
      lat: p.lat,
      lng: p.lng,
      distance: p.distance_m,
      place_url: p.kakao_url,
      relaxed: p.relaxed,
      rank: idx + 1,
      ai_reason: claude?.reason ?? null,
      confidence: claude?.confidence ?? null,
    };
  });

  const { error } = await supabase.from('recommendations').insert(rows);
  if (error) throw error;
}

/**
 * 집계 실행: collecting → aggregating → voting
 * 원자적 상태 전환으로 동시 요청 중복 방지.
 */
export async function aggregate(sessionId: string): Promise<void> {
  const { data: session, error } = await supabase
    .from('sessions')
    .update({ status: 'aggregating' })
    .eq('id', sessionId)
    .eq('status', 'collecting')
    .select('station_id')
    .single();

  if (error || !session) return; // 이미 다른 프로세스가 처리 중이거나 상태가 다름

  const stationId = session.station_id as string;

  try {
    const [places, responses] = await Promise.all([
      getOrFetchRestaurants(stationId),
      getStage1Responses(sessionId),
    ]);

    // 2단계 웹서치 보완은 비동기 백그라운드 (CLAUDE.md §6) — 이번 집계는 차단하지 않고
    // 다음 세션을 위해 restaurants 웹서치 컬럼(가격·분위기·평점)을 채워둔다.
    // 사전 배치된 주요 역은 이미 보완되어 있어 이번 집계부터 파이프라인이 정상 작동.
    void enrichStationRestaurants(stationId).catch((err) =>
      console.error(`enrichStationRestaurants 실패 (${stationId}):`, err),
    );

    const result = runPipeline(places, responses);

    if (result.recommended.length > 0) {
      const budgetCap = computeBudgetCap(responses.map((r) => r.budget_max));
      const eligibleCategories = getEligibleCategories(responses.map((r) => r.categories));
      const quietRatio = computeQuietRatio(responses.map((r) => r.mood));
      const dominantMood: 'quiet' | 'any' = quietRatio > 0.5 ? 'quiet' : 'any';

      const claudeResults = await getClaudeRecommendations(result.recommended, {
        budget_max: budgetCap,
        mood: dominantMood,
        categories: eligibleCategories,
      });

      await storeRecommendations(sessionId, result.recommended, claudeResults);
    }

    await supabase
      .from('sessions')
      .update({ status: 'voting' })
      .eq('id', sessionId)
      .eq('status', 'aggregating');
  } catch (err) {
    // 집계 중 실패 시 aggregating에 영구 고착되지 않도록 collecting으로 롤백 → 재시도 가능.
    console.error(`aggregate 실패 (${sessionId}) — collecting으로 롤백:`, err);
    await supabase
      .from('sessions')
      .update({ status: 'collecting' })
      .eq('id', sessionId)
      .eq('status', 'aggregating');
  }
}

/**
 * 마감시간 Lazy 체크: 접근 시점에 now > deadline 이면 집계 트리거.
 */
export async function checkDeadlineAndAggregate(sessionId: string): Promise<void> {
  const { data: session } = await supabase
    .from('sessions')
    .select('status, deadline')
    .eq('id', sessionId)
    .single();

  if (!session) return;
  if (session.status !== 'collecting') return;
  if (!session.deadline) return;
  if (new Date() <= new Date(session.deadline as string)) return;

  await aggregate(sessionId);
}
