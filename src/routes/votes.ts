// POST /sessions/:id/votes/stage1 — 제약 응답 (직접 컬럼 삽입)
// POST /sessions/:id/votes/stage2 — 식당 👍 (restaurant_id = recommendations.id)

import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// 참여자 확인 헬퍼
async function isParticipant(sessionId: string, userKey: number): Promise<boolean> {
  const { data } = await supabase
    .from('participants')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_key', userKey)
    .single();
  return data != null;
}

// stage1: drink, budgetMin?, budgetMax, categories[], mood? → 단일 행 삽입
router.post('/:id/votes/stage1', requireAuth, async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id;
  const userKey = req.userKey!;
  const {
    drink,
    budgetMin,
    budgetMax,
    categories = [],
    mood,
  } = req.body as {
    drink?: string;
    budgetMin?: number;
    budgetMax?: number;
    categories?: string[];
    mood?: string;
  };

  if (!drink || budgetMax == null) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'drink과 budgetMax가 필요합니다' });
    return;
  }
  if (!['drinker', 'ok', 'uncomfortable'].includes(drink)) {
    res.status(400).json({
      code: 'BAD_REQUEST',
      message: 'drink은 drinker/ok/uncomfortable 중 하나여야 합니다',
    });
    return;
  }
  if (mood && !['quiet', 'any'].includes(mood)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'mood는 quiet/any 중 하나여야 합니다' });
    return;
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (!session) {
    res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' });
    return;
  }
  if (session.status !== 'collecting') {
    res
      .status(409)
      .json({ code: 'INVALID_STATUS', message: '투표 수집 중인 세션에만 응답할 수 있습니다' });
    return;
  }

  if (!(await isParticipant(sessionId, userKey))) {
    res
      .status(403)
      .json({ code: 'NOT_PARTICIPANT', message: '세션에 참여한 사용자만 응답할 수 있습니다' });
    return;
  }

  const { error } = await supabase.from('votes').insert({
    session_id: sessionId,
    user_key: userKey,
    stage: 1,
    drink: drink as 'drinker' | 'ok' | 'uncomfortable',
    budget_min: budgetMin ?? null,
    budget_max: budgetMax,
    categories,
    mood: (mood as 'quiet' | 'any' | undefined) ?? null,
  });

  if (error?.code === '23505') {
    res.status(409).json({ code: 'ALREADY_VOTED', message: '이미 응답한 세션입니다' });
    return;
  }
  if (error) {
    res.status(500).json({ code: 'DB_ERROR', message: error.message });
    return;
  }

  res.status(201).json({ message: '응답이 완료됐습니다' });
});

// stage2: restaurantId(recommendations.id) → 식당 👍
router.post('/:id/votes/stage2', requireAuth, async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id;
  const userKey = req.userKey!;
  const { restaurantId } = req.body as { restaurantId?: string };

  if (!restaurantId) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'restaurantId가 필요합니다' });
    return;
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (!session) {
    res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' });
    return;
  }
  if (session.status !== 'voting') {
    res
      .status(409)
      .json({ code: 'INVALID_STATUS', message: '투표 단계에서만 식당을 선택할 수 있습니다' });
    return;
  }

  if (!(await isParticipant(sessionId, userKey))) {
    res
      .status(403)
      .json({ code: 'NOT_PARTICIPANT', message: '세션에 참여한 사용자만 투표할 수 있습니다' });
    return;
  }

  // 해당 세션의 추천 후보인지 확인 (recommendations.id)
  const { data: rec } = await supabase
    .from('recommendations')
    .select('id')
    .eq('session_id', sessionId)
    .eq('id', restaurantId)
    .single();

  if (!rec) {
    res.status(404).json({ code: 'NOT_FOUND', message: '해당 후보 식당을 찾을 수 없습니다' });
    return;
  }

  const { error } = await supabase.from('votes').insert({
    session_id: sessionId,
    user_key: userKey,
    stage: 2,
    restaurant_id: restaurantId,
  });

  if (error?.code === '23505') {
    res.status(409).json({ code: 'ALREADY_VOTED', message: '이미 투표했습니다' });
    return;
  }
  if (error) {
    res.status(500).json({ code: 'DB_ERROR', message: error.message });
    return;
  }

  res.status(201).json({ message: '투표가 완료됐습니다' });
});

export default router;
