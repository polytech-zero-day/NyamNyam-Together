import { supabase } from './supabase.ts';

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
    .eq('status', 'voting');

  if (updateErr) throw updateErr;

  return { isTied: false as const, winnerId, voteCount: maxCount };
}
