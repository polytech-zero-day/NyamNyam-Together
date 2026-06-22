// POST /sessions/:id/join

import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/:id/join', requireAuth, async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id;
  const userKey = req.userKey!;

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
    res.status(409).json({ code: 'INVALID_STATUS', message: '투표 수집 중인 세션에만 참여할 수 있습니다' });
    return;
  }

  const { error } = await supabase
    .from('participants')
    .insert({ session_id: sessionId, user_key: userKey });

  if (error?.code === '23505') {
    res.status(409).json({ code: 'ALREADY_JOINED', message: '이미 참여한 세션입니다' });
    return;
  }
  if (error) {
    res.status(500).json({ code: 'DB_ERROR', message: error.message });
    return;
  }

  res.status(201).json({ message: '참여가 완료됐습니다' });
});

export default router;
