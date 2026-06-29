import { supabase } from './supabase.ts';
import { recommend } from './recommend.ts';
import { buildConstraintsFromVotes, tallySortMode } from './voteAggregation.ts';
import type { Stage1Vote } from './voteAggregation.ts';
import type { Station } from './domain/types.ts';
import type { DrinkValue, MoodValue } from './database.types.ts';

async function getStage1Votes(sessionId: string): Promise<Stage1Vote[]> {
  const { data, error } = await supabase
    .from('votes')
    .select('drink, budget_min, budget_max, categories, mood, sort_pref')
    .eq('session_id', sessionId)
    .eq('stage', 1);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    drink: (row.drink as DrinkValue) ?? 'ok',
    budget_min: row.budget_min,
    budget_max: row.budget_max,
    categories: Array.isArray(row.categories) ? (row.categories as string[]) : [],
    mood: row.mood as MoodValue | null,
    sort_pref: (row.sort_pref as Stage1Vote['sort_pref']) ?? null,
  }));
}

export async function aggregate(sessionId: string): Promise<void> {
  const { data: session, error } = await supabase
    .from('sessions')
    .update({ status: 'aggregating' })
    .eq('id', sessionId)
    .eq('status', 'collecting')
    .select('station_id')
    .single();

  if (error || !session) return;

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

    await recommend(sessionId, constraints, station);

    // 정렬 기준은 참여자 다수결로 결정(동점/무응답 → review_count).
    const sortMode = tallySortMode(votes);
    await supabase
      .from('sessions')
      .update({ status: 'voting', sort_mode: sortMode })
      .eq('id', sessionId)
      .eq('status', 'aggregating');
  } catch (err) {
    console.error(`aggregate 실패 (${sessionId}) — collecting으로 롤백:`, err);
    // 부분 삽입된 추천 행 정리
    await supabase.from('recommendations').delete().eq('session_id', sessionId);
    await supabase
      .from('sessions')
      .update({ status: 'collecting' })
      .eq('id', sessionId)
      .eq('status', 'aggregating');
  }
}

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
