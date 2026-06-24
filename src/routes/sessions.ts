// /sessions 라우트
// POST /sessions, GET /sessions/:id, POST /sessions/:id/close, GET /sessions/:id/progress

import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
// requireToss: 그룹 생성·종료는 토스 host만(인증 모델 B). 참여·조회는 requireAuth(익명 허용).
import { requireAuth, requireToss, AuthRequest } from '../middleware/auth';
import { aggregate, checkDeadlineAndAggregate } from '../services/aggregation';
import { finalizeSession, FinalizeError } from '../services/finalVote';
import { ensureStation } from '../services/googlePlaces';

const router = Router();

// POST /sessions — 모임 생성 (host=토스 필수)
router.post('/', requireToss, async (req: AuthRequest, res: Response) => {
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

  if (!stationId || !title) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'stationId, title이 필요합니다' });
    return;
  }

  // 역 좌표 해결: 좌표를 직접 주면 등록(back-compat), 안 주면 미리 적재된 station_places에서 조회.
  // (역 좌표는 정적 데이터 — 구글 등 외부 API 불필요. seed-stations로 주요 역 적재)
  if (stationLat != null && stationLng != null) {
    await ensureStation(stationId, stationLat, stationLng);
  } else {
    const { data: st } = await supabase
      .from('station_places')
      .select('station_id')
      .eq('station_id', stationId)
      .maybeSingle();
    if (!st) {
      res.status(400).json({
        code: 'UNKNOWN_STATION',
        message: '등록되지 않은 역입니다. 주요 역에서 선택해주세요',
      });
      return;
    }
  }

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
    console.error('세션 생성 실패:', error);
    res.status(500).json({ code: 'DB_ERROR', message: '세션 생성에 실패했습니다' });
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

// POST /sessions/:id/close — 생성자 수동 종료 → 집계 트리거 (host=토스 필수)
router.post('/:id/close', requireToss, async (req: AuthRequest, res: Response) => {
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

// POST /sessions/:id/finalize — stage2 집계, 최종 식당 확정 (host=토스 필수)
// 동점 시: isTied:true + tiedIds 반환 (상태 미전환). 호스트가 forceWinnerId로 재호출해 해소.
router.post('/:id/finalize', requireToss, async (req: AuthRequest, res: Response) => {
  const { forceWinnerId } = req.body as { forceWinnerId?: string };

  const { data: session } = await supabase
    .from('sessions')
    .select('host_user_key')
    .eq('id', req.params.id)
    .single();

  if (!session) {
    res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' });
    return;
  }
  if (session.host_user_key !== req.userKey) {
    res.status(403).json({ code: 'FORBIDDEN', message: '생성자만 집계할 수 있습니다' });
    return;
  }

  try {
    const result = await finalizeSession(req.params.id, forceWinnerId);
    res.json(result);
  } catch (err) {
    if (err instanceof FinalizeError) {
      res.status(err.status).json({ code: err.code, message: err.message });
      return;
    }
    throw err;
  }
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
