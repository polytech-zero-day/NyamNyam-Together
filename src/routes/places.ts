// 식당 등록 (우리 소유, api-spec.md) — 프론트 화면 우선, 백엔드 first-party 저장 최소 스텁.
// POST /places            — 점주(owner)/시민(community) 등록 → { placeId }
// GET  /places?stationId=  — 역의 등록 식당 목록
// ⚠️ 검증·심사는 추후. 구글 식당(source=google)은 이 경로로 만들지 않는다.

import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import type { PlaceSource, PlaceType } from '../types/database.types';

const router = Router();

const SOURCES: PlaceSource[] = ['owner', 'community'];
const PLACE_TYPES: PlaceType[] = ['drink_required', 'compatible', 'general'];

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { source, stationId, name, lat, lng, category, priceLevel, openDate, placeType } =
    req.body as {
      source?: string;
      stationId?: string;
      name?: string;
      lat?: number;
      lng?: number;
      category?: string;
      priceLevel?: number;
      openDate?: string;
      placeType?: string;
    };

  if (!source || !SOURCES.includes(source as PlaceSource)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'source는 owner/community 중 하나여야 합니다' });
    return;
  }
  if (!stationId || !name || lat == null || lng == null) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'stationId, name, lat, lng가 필요합니다' });
    return;
  }
  if (priceLevel != null && (priceLevel < 1 || priceLevel > 4)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'priceLevel은 1~4여야 합니다' });
    return;
  }
  if (placeType && !PLACE_TYPES.includes(placeType as PlaceType)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'placeType이 올바르지 않습니다' });
    return;
  }

  const { data, error } = await supabase
    .from('places')
    .insert({
      source: source as PlaceSource,
      station_id: stationId,
      name,
      lat,
      lng,
      category: category ?? null,
      price_level: priceLevel ?? null,
      open_date: openDate ?? null,
      // 등록 분류로 place_type 직접 지정(없으면 null → 추후 사람 검수, domain-rules.md §1)
      place_type: (placeType as PlaceType | undefined) ?? null,
      status: 'active',
    })
    .select('id')
    .single();

  if (error || !data) {
    res.status(500).json({ code: 'DB_ERROR', message: error?.message });
    return;
  }
  res.status(201).json({ placeId: data.id });
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const stationId = req.query.stationId as string | undefined;
  if (!stationId) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'stationId 쿼리가 필요합니다' });
    return;
  }

  const { data, error } = await supabase
    .from('places')
    .select('id, source, name, lat, lng, category, price_level, open_date, place_type, status')
    .eq('station_id', stationId)
    .in('source', ['owner', 'community']);

  if (error) {
    res.status(500).json({ code: 'DB_ERROR', message: error.message });
    return;
  }
  res.json({ places: data ?? [] });
});

export default router;
