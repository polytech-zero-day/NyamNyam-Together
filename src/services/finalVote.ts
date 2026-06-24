// stage2 투표 집계: 득표 집계 → 동점 처리 → 최종 식당 확정 → voting→closed 전환

import { supabase } from '../config/supabase';

export type FinalizeResult =
  | { isTied: true; tiedIds: string[]; voteCount: number }
  | { isTied: false; winnerId: string; voteCount: number };

export class FinalizeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

/**
 * stage2 투표를 집계해 최종 식당을 확정하고 세션을 closed로 전환한다.
 *
 * 동점 발생 시 isTied:true + tiedIds를 반환하며 상태를 바꾸지 않는다.
 * 호스트는 tiedIds 중 하나를 forceWinnerId로 다시 호출해 동점을 해소한다.
 */
export async function finalizeSession(
  sessionId: string,
  forceWinnerId?: string,
): Promise<FinalizeResult> {
  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (!session) throw new FinalizeError('세션을 찾을 수 없습니다', 404, 'NOT_FOUND');
  if (session.status !== 'voting')
    throw new FinalizeError('투표 단계에서만 집계할 수 있습니다', 409, 'INVALID_STATUS');

  const { data: votes, error } = await supabase
    .from('votes')
    .select('recommendation_id')
    .eq('session_id', sessionId)
    .eq('stage', 2)
    .not('recommendation_id', 'is', null);

  if (error) throw error;
  if (!votes?.length) throw new FinalizeError('아직 투표가 없습니다', 409, 'NO_VOTES');

  // 득표 집계
  const counts = new Map<string, number>();
  for (const v of votes) {
    const id = v.recommendation_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  const tiedIds = [...counts.entries()]
    .filter(([, c]) => c === maxCount)
    .map(([id]) => id)
    .sort();

  // 동점 — forceWinnerId 없으면 호스트에게 선택 위임
  if (tiedIds.length > 1 && !forceWinnerId) {
    return { isTied: true, tiedIds, voteCount: maxCount };
  }

  let winnerId: string;
  if (forceWinnerId) {
    if (!tiedIds.includes(forceWinnerId))
      throw new FinalizeError('forceWinnerId가 동점 후보에 없습니다', 400, 'INVALID_WINNER');
    winnerId = forceWinnerId;
  } else {
    winnerId = tiedIds[0]!;
  }

  const { error: updateErr } = await supabase
    .from('sessions')
    .update({ winner_recommendation_id: winnerId, status: 'closed' })
    .eq('id', sessionId)
    .eq('status', 'voting'); // 동시 집계 방지 optimistic lock

  if (updateErr) throw updateErr;

  return { isTied: false as const, winnerId, voteCount: maxCount };
}
