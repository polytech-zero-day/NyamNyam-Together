// /sessions 라우트
// POST /sessions, GET /sessions/:id, POST /sessions/:id/close, GET /sessions/:id/progress

import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { aggregate, checkDeadlineAndAggregate } from '../services/aggregation';
// 우리(A) station_places 헬퍼 위치 이동(kakao → googlePlaces)에 따른 import 동기화. 세션 로직 불변(B 소유).
import { ensureStation } from '../services/googlePlaces';

const router = Router();

// POST /sessions — 모임 생성
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { stationId, stationLat, stationLng, title, minParticipants, purpose, deadline } =
    req.body as {
      stationId?: string;
      stationLat?: number;
      stationLng?: number;
      title?: string;
      minParticipants?: number;
      purpose?: string;
      deadline?: string;
    };

  if (!stationId || stationLat == null || stationLng == null || !title) {
    res.status(400).json({
      code: 'BAD_REQUEST',
      message: 'stationId, stationLat, stationLng, title이 필요합니다',
    });
    return;
  }

  await ensureStation(stationId, stationLat, stationLng);

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      host_user_key: req.userKey!,
      station_id: stationId,
      title,
      min_participants: minParticipants ?? 2,
      purpose: purpose ?? null,
      deadline: deadline ?? null,
      status: 'collecting',
    })
    .select('id')
    .single();

  if (error || !data) {
    res.status(500).json({ code: 'DB_ERROR', message: error?.message });
    return;
  }

  await supabase.from('participants').insert({ session_id: data.id, user_key: req.userKey! });

  res.status(201).json({ sessionId: data.id, inviteLink: `/sessions/${data.id}/join` });
});

// GET /sessions/:id — 모임 정보 (마감 Lazy 체크 포함)
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  await checkDeadlineAndAggregate(req.params.id);

  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !session) {
    res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' });
    return;
  }

  const { count } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', req.params.id);

  res.json({ ...session, participantCount: count ?? 0 });
});

// POST /sessions/:id/close — 생성자 수동 종료 → 집계 트리거
router.post('/:id/close', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data: session, error } = await supabase
    .from('sessions')
    .select('host_user_key, status')
    .eq('id', req.params.id)
    .single();

  if (error || !session) {
    res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' });
    return;
  }
  if (session.host_user_key !== req.userKey) {
    res.status(403).json({ code: 'FORBIDDEN', message: '생성자만 종료할 수 있습니다' });
    return;
  }
  if (session.status !== 'collecting') {
    res
      .status(409)
      .json({ code: 'INVALID_STATUS', message: '투표 수집 중인 상태에서만 종료할 수 있습니다' });
    return;
  }

  await aggregate(req.params.id);
  res.json({ message: '집계를 시작했습니다' });
});

// GET /sessions/:id/progress — N/M명 stage1 응답 현황
router.get('/:id/progress', requireAuth, async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id;

  const [{ count: total }, { count: responded }] = await Promise.all([
    supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId),
    supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('stage', 1),
  ]);

  res.json({ responded: responded ?? 0, total: total ?? 0 });
});

export default router;
