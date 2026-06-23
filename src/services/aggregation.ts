// ⚠️⚠️ B 소유 영역 임시 브리지 ⚠️⚠️ (CLAUDE.md §0 핸드오프)
// 상태전환(collecting→aggregating→voting)·마감 트리거·votes 원본 집계는 B 소유다.
// B 브랜치가 아직 없어 데모 동작을 위해 임시로 둔다. **B 병합 시 이 파일은 B 정본으로 교체**하고,
// 우리 연결점은 services/recommend.ts의 recommend(sessionId, AggregatedConstraints, station)뿐이다.
//
// 우리(C) 소유는 recommend() 안에만 있다. 이 파일의 votes→제약 집계는 B가 가져갈 placeholder.

import { supabase } from '../config/supabase';
import { recommend } from './recommend';
import type { AggregatedConstraints, MoodPref, Station } from '../domain/types';
import type { DrinkValue, MoodValue } from '../types/database.types';

interface Stage1Vote {
  drink: DrinkValue;
  budget_min: number | null;
  budget_max: number;
  categories: string[];
  mood: MoodValue | null;
}

// ── TEMP(B 소유): votes stage1 원본 집계 → AggregatedConstraints ───────────────
// B가 산출할 입력 계약(domain-rules.md §0)을 데모용으로 임시 재현한다. 병합 시 제거.
function buildConstraints(votes: Stage1Vote[]): AggregatedConstraints {
  const drink = { drinker: 0, ok: 0, uncomfortable: 0 };
  for (const v of votes) drink[v.drink] += 1;

  const budgetMaxes = votes.map((v) => v.budget_max).sort((a, b) => a - b);
  const budgetMins = votes
    .map((v) => v.budget_min)
    .filter((x): x is number => typeof x === 'number')
    .sort((a, b) => a - b);
  // 상한: P25 완충(0개 위험 완화), 하한: 최솟값(소프트)
  const budgetMax = budgetMaxes.length
    ? budgetMaxes[Math.floor(budgetMaxes.length * 0.25)]
    : Infinity;
  const budgetMin = budgetMins.length ? budgetMins[0] : 0;

  const catCounts = new Map<string, number>();
  for (const v of votes) {
    for (const c of v.categories) {
      if (c.trim()) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
    }
  }
  const categories = [...catCounts.entries()].map(([name, count]) => ({ name, votes: count }));

  const moods = votes.map((v) => v.mood).filter((m): m is MoodValue => m === 'quiet' || m === 'any');
  let moodDominant: MoodPref | null = null;
  if (moods.length > 0) {
    const quietRatio = moods.filter((m) => m === 'quiet').length / moods.length;
    moodDominant = quietRatio > 0.5 ? 'quiet' : 'any';
  }

  return { drink, budgetMin, budgetMax, categories, moodDominant };
}

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
    budget_max: (row.budget_max as number) ?? 0,
    categories: Array.isArray(row.categories) ? (row.categories as string[]) : [],
    mood: row.mood as MoodValue | null,
  }));
}
// ── /TEMP(B 소유) ─────────────────────────────────────────────────────────────

/**
 * 집계 실행: collecting → aggregating → voting (B 소유 상태머신, 임시).
 * 우리 연결점은 recommend() 호출 한 곳뿐.
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

    const votes = await getStage1Votes(sessionId);
    const constraints = buildConstraints(votes);

    // ★ 우리(C) 소유 연결점
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

/** 마감시간 Lazy 체크: now > deadline 이면 집계 트리거 (B 소유, 임시). */
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
