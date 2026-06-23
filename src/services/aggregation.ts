// 상태전환 브리지 + 잠정 집계 (integ/backend-merge 절충안)
// ⚠️ 상태전환(collecting→aggregating→voting)·마감 트리거·votes 원본 집계는 본래 B 소유다.
// B 담당 합류 전까지 통합 브랜치가 실제 그룹 제약을 반영하도록 **잠정 절충안**으로 둔다.
// 집계 로직은 services/voteAggregation.ts(PROVISIONAL)에 분리 — B 합류 시 그 모듈+이 파일을 교체.
// 우리(C)의 정식 연결점은 recommend(sessionId, AggregatedConstraints, Station) 한 곳뿐.

import { supabase } from '../config/supabase';
import { recommend } from './recommend';
import { buildConstraintsFromVotes, Stage1Vote } from './voteAggregation';
import type { Station } from '../domain/types';
import type { DrinkValue, MoodValue } from '../types/database.types';

// stage1 votes 조회 (잠정 — B 합류 시 B 집계 RPC/서비스로 대체)
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
 * 집계 실행: collecting → aggregating → voting.
 * (상태머신·집계는 본래 B 소유 — 여기선 잠정. 우리 연결점은 recommend() 호출.)
 */
export async function aggregate(sessionId: string): Promise<void> {
  const { data: session, error } = await supabase
    .from('sessions')
    .update({ status: 'aggregating' })
    .eq('id', sessionId)
    .eq('status', 'collecting')
    .select('station_id')
    .single();

  if (error || !session) return; // 이미 처리 중이거나 상태 불일치

  const stationId = session.station_id as string;

  try {
    // 역 좌표는 station_places(우리 소유)에서 조회 — Nearby 호출 좌표원
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

    // 잠정 절충안: stage1 votes → AggregatedConstraints (B 합류 시 B 집계로 교체)
    const votes = await getStage1Votes(sessionId);
    const constraints = buildConstraintsFromVotes(votes);

    // ★ 우리(C) 정식 연결점
    await recommend(sessionId, constraints, station);

    await supabase
      .from('sessions')
      .update({ status: 'voting' })
      .eq('id', sessionId)
      .eq('status', 'aggregating');
  } catch (err) {
    // 실패 시 collecting으로 롤백(영구 고착 방지 → 재시도 가능)
    console.error(`aggregate 실패 (${sessionId}) — collecting으로 롤백:`, err);
    await supabase
      .from('sessions')
      .update({ status: 'collecting' })
      .eq('id', sessionId)
      .eq('status', 'aggregating');
  }
}

/** 마감시간 Lazy 체크: now > deadline 이면 집계 트리거 (본래 B 소유, 잠정). */
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
