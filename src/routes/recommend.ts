// GET /sessions/:id/recommendations — 후보 식당 목록 + 투표 수

import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { checkDeadlineAndAggregate } from '../services/aggregation';

const router = Router();

router.get('/:id/recommendations', requireAuth, async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id;

  await checkDeadlineAndAggregate(sessionId);

  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (!session) {
    res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' });
    return;
  }

  // 아직 집계 전 (collecting / aggregating) → 진행 중 응답
  if (['collecting', 'aggregating'].includes(session.status)) {
    res.status(202).json({
      code: 'NOT_READY',
      message: '아직 집계 전입니다',
      status: session.status,
    });
    return;
  }

  // 집계 결과는 recommendations 테이블에 저장됨 (rank 오름차순)
  const { data: recommendations, error } = await supabase
    .from('recommendations')
    .select('*')
    .eq('session_id', sessionId)
    .order('rank', { ascending: true })
    .limit(4); // 화면엔 상위 4곳

  if (error) {
    res.status(500).json({ code: 'DB_ERROR', message: error.message });
    return;
  }

  // stage2 투표 집계 (최다 득표 자연 부상, 억지 확정 없음)
  // votes.restaurant_id → recommendations.id 참조
  const { data: stage2Votes } = await supabase
    .from('votes')
    .select('restaurant_id')
    .eq('session_id', sessionId)
    .eq('stage', 2);

  const voteCounts: Record<string, number> = {};
  for (const v of stage2Votes ?? []) {
    if (v.restaurant_id) {
      voteCounts[v.restaurant_id] = (voteCounts[v.restaurant_id] ?? 0) + 1;
    }
  }

  const result = (recommendations ?? []).map((r) => ({
    ...r,
    voteCount: voteCounts[r.id] ?? 0,
  }));

  res.json({
    recommendations: result,
    relaxed: result.some((r) => r.relaxed),
  });
});

export default router;
