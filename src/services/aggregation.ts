// 상태전환 브리지: collecting→aggregating→voting
// stage1 votes 조회 → 제약 집계(voteAggregation) → C 추천 파이프라인(recommend) 호출

import { supabase } from '../config/supabase';
import { recommend } from './recommend';
import { buildConstraintsFromVotes, Stage1Vote } from './voteAggregation';
import type { Station } from '../domain/types';
import type { DrinkValue, MoodValue } from '../types/database.types';

async function getStage1Votes(sessionId: string): Promise<Stage1Vote[]> {
  const { data, error } = await supabase
    .from('votes')
    .select('drink, budget_min, budget_max, categories, mood')
    .eq('session_id', sessionId)
    .eq('stage', 1);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    drink: (row.drink as DrinkValue) ?? 'ok',
    budget_min: row.budget_min,
    budget_max: row.budget_max,
    categories: Array.isArray(row.categories) ? (row.categories as string[]) : [],
    mood: row.mood as MoodValue | null,
  }));
}

/**
 * stage1 마감 집계: collecting → aggregating → voting
 * 실패 시 collecting으로 롤백해 재시도 가능하게 한다.
 */
export async function aggregate(sessionId: string): Promise<void> {
  const { data: session, error } = await supabase
    .from('sessions')
    .update({ status: 'aggregating' })
    .eq('id', sessionId)
    .eq('status', 'collecting')
    .select('station_id')
    .single();

  if (error || !session) return; // 이미 처리 중이거나 상태 불일치 — 멱등 처리

  const stationId = session.station_id as string;

  try {
    const { data: stationMeta } = await supabase
      .from('station_places')
      .select('station_lat, station_lng')
      .eq('station_id', stationId)
      .single();
    if (!stationMeta) throw new Error(`station_places not found: ${stationId}`);

    const station: Station = {
      id: stationId,
      lat: Number(stationMeta.station_lat),
      lng: Number(stationMeta.station_lng),
    };

    const votes = await getStage1Votes(sessionId);
    const constraints = buildConstraintsFromVotes(votes);

    // C 파트 연결점 — AggregatedConstraints → recommendations 작성
    await recommend(sessionId, constraints, station);

    await supabase
      .from('sessions')
      .update({ status: 'voting' })
      .eq('id', sessionId)
      .eq('status', 'aggregating');
  } catch (err) {
    console.error(`aggregate 실패 (${sessionId}) — collecting으로 롤백:`, err);
    await supabase
      .from('sessions')
      .update({ status: 'collecting' })
      .eq('id', sessionId)
      .eq('status', 'aggregating');
  }
}

/** 마감시간 Lazy 체크: deadline 초과 시 집계 트리거 */
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
