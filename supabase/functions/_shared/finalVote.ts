import { supabase } from './supabase.ts';

export type FinalizeResult = { isTied: false; winnerId: string; voteCount: number };

export class FinalizeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

export async function finalizeSession(sessionId: string): Promise<FinalizeResult> {
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
    .select('recommendation_id, created_at')
    .eq('session_id', sessionId)
    .eq('stage', 2)
    .not('recommendation_id', 'is', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!votes?.length) throw new FinalizeError('아직 투표가 없습니다', 409, 'NO_VOTES');

  const counts = new Map<string, number>();
  const lastVotedAt = new Map<string, string>();
  for (const v of votes) {
    const id = v.recommendation_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    lastVotedAt.set(id, v.created_at as string); // ascending 정렬이므로 마지막이 최신
  }
  const maxCount = Math.max(...counts.values());
  const tiedIds = [...counts.entries()]
    .filter(([, c]) => c === maxCount)
    .map(([id]) => id);

  // 동점 시 가장 마지막에 투표된 식당으로 자동 결정
  const winnerId = tiedIds.length === 1
    ? tiedIds[0]!
    : tiedIds.sort((a, b) => {
        const ta = lastVotedAt.get(a) ?? '';
        const tb = lastVotedAt.get(b) ?? '';
        return tb > ta ? 1 : tb < ta ? -1 : 0;
      })[0]!;

  const { error: updateErr } = await supabase
    .from('sessions')
    .update({ winner_recommendation_id: winnerId, status: 'closed' })
    .eq('id', sessionId)
    .eq('status', 'voting');

  if (updateErr) throw updateErr;

  return { isTied: false as const, winnerId, voteCount: maxCount };
}
