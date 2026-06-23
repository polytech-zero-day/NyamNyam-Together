// 추천 조회·정렬 (우리 소유, api-spec.md / integration-contract.md 통합 카드)
// GET  /sessions/:id/recommendations — 통합 카드(거리·지도·1위 포함) + Powered by Google
// PATCH /sessions/:id/sort           — 정렬 모드 변경 (세션 공유, voting에서 허용)

import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { checkDeadlineAndAggregate } from '../services/aggregation';
import { placeDetails } from '../services/googlePlaces';
import { applySortMode, SortMode } from '../domain/sort';
import { distanceFromStation } from '../domain/geo';
import type { Station } from '../domain/types';

const ATTRIBUTION = 'Powered by Google';

const router = Router();

const DISPLAY_COUNT = 4; // 화면 노출 후보 수
const SORT_MODES: SortMode[] = ['review_count', 'rating', 'random'];

interface RecRow {
  id: string;
  place_id: string;
  place_type: string | null;
  rank: number;
  relaxed: boolean;
  review_count_at_agg: number | null;
  rating_at_agg: number | null;
  places: {
    source: 'google' | 'owner' | 'community';
    google_place_id: string | null;
    name: string | null;
    category: string | null;
    price_level: number | null;
    lat: number | null;
    lng: number | null;
  } | null;
}

router.get('/:id/recommendations', requireAuth, async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id;

  await checkDeadlineAndAggregate(sessionId);

  const { data: session } = await supabase
    .from('sessions')
    .select('status, sort_mode, sort_seed, station_id')
    .eq('id', sessionId)
    .single();

  if (!session) {
    res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' });
    return;
  }
  if (['collecting', 'aggregating'].includes(session.status)) {
    res
      .status(202)
      .json({ code: 'NOT_READY', message: '아직 집계 전입니다', status: session.status });
    return;
  }

  // 역 좌표 (거리 계산용) — 표시 시점 라이브 거리 산출에 사용
  const { data: stationRow } = await supabase
    .from('station_places')
    .select('station_lat, station_lng')
    .eq('station_id', session.station_id)
    .single();
  const station: Station | null = stationRow
    ? {
        id: session.station_id,
        lat: Number(stationRow.station_lat),
        lng: Number(stationRow.station_lng),
      }
    : null;

  // 후보 + place 참조 (구글 콘텐츠는 미저장 → place_id/source만)
  const { data: recs, error } = await supabase
    .from('recommendations')
    .select(
      'id, place_id, place_type, rank, relaxed, review_count_at_agg, rating_at_agg, ' +
        'places(source, google_place_id, name, category, price_level, lat, lng)',
    )
    .eq('session_id', sessionId)
    .order('rank', { ascending: true });

  if (error) {
    res.status(500).json({ code: 'DB_ERROR', message: error.message });
    return;
  }

  const rows = (recs ?? []) as unknown as RecRow[];

  // 정렬: ?sort= 우선, 없으면 세션 sort_mode (표시 순서만, 후보·집계 불변)
  const queryMode = req.query.sort as SortMode | undefined;
  const mode: SortMode = SORT_MODES.includes(queryMode as SortMode)
    ? (queryMode as SortMode)
    : (session.sort_mode as SortMode);

  const sorted = applySortMode(
    rows,
    mode,
    (r) => ({
      rating: r.rating_at_agg,
      reviewCount: r.review_count_at_agg,
      registered: r.places?.source !== 'google',
    }),
    session.sort_seed ?? 1,
  ).slice(0, DISPLAY_COUNT);

  // 표시용 이름·평점은 최종 후보만 라이브 조회 (구글), 등록 식당은 저장값 사용
  const googleIds = sorted
    .map((r) => r.places?.google_place_id)
    .filter((id): id is string => typeof id === 'string');
  const details = await placeDetails(googleIds);

  // stage2 투표 수 (★ 집계는 B 소유 — 우리는 표시만 연결)
  const { data: stage2Votes } = await supabase
    .from('votes')
    .select('recommendation_id')
    .eq('session_id', sessionId)
    .eq('stage', 2);
  const voteCounts: Record<string, number> = {};
  for (const v of stage2Votes ?? []) {
    if (v.recommendation_id)
      voteCounts[v.recommendation_id] = (voteCounts[v.recommendation_id] ?? 0) + 1;
  }

  const result = sorted.map((r) => {
    const isGoogle = r.places?.source === 'google';
    const live = r.places?.google_place_id ? details.get(r.places.google_place_id) : undefined;
    // 거리(표시 시점 라이브): 구글=Details 좌표, 등록=places 저장 좌표. station 없으면 null.
    const lat = isGoogle ? (live?.lat ?? null) : (r.places?.lat ?? null);
    const lng = isGoogle ? (live?.lng ?? null) : (r.places?.lng ?? null);
    const distanceM = station ? distanceFromStation({ lat, lng }, station) : null;
    return {
      recId: r.id, // stage2 투표용 식별자 (recommendations.id)
      placeId: r.places?.google_place_id ?? r.place_id, // 구글=place_id, 등록=내부 id
      rank: r.rank,
      placeType: r.place_type,
      relaxed: r.relaxed,
      source: r.places?.source ?? null,
      // 구글: 라이브 표시값(미저장), 폴백은 집계 스냅샷. 등록: 저장값.
      name: live?.name ?? r.places?.name ?? null,
      rating: live?.rating ?? r.rating_at_agg,
      reviewCount: live?.userRatingCount ?? r.review_count_at_agg,
      priceLevel: live?.priceLevel ?? r.places?.price_level ?? null,
      distanceM,
      mapUrl: live?.mapUrl ?? null,
      voteCount: voteCounts[r.id] ?? 0,
      poweredByGoogle: isGoogle, // 프론트 "Powered by Google" 출처 표기
    };
  });

  // 현재 1위(표시용 — 최종 집계·동점은 B 소유). 득표 0이면 leader 없음.
  const leader = result.reduce<{ recId: string; voteCount: number } | null>((best, c) => {
    if (c.voteCount <= 0) return best;
    return !best || c.voteCount > best.voteCount
      ? { recId: c.recId, voteCount: c.voteCount }
      : best;
  }, null);

  res.json({
    sortMode: mode,
    relaxed: result.some((r) => r.relaxed),
    attribution: ATTRIBUTION,
    leader,
    recommendations: result,
  });
});

// PATCH /sessions/:id/sort — 정렬 모드 변경 (세션 공유, 개인별 아님)
router.patch('/:id/sort', requireAuth, async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id;
  const { sortMode } = req.body as { sortMode?: string };

  if (!sortMode || !SORT_MODES.includes(sortMode as SortMode)) {
    res.status(400).json({
      code: 'BAD_REQUEST',
      message: 'sortMode는 review_count/rating/random 중 하나여야 합니다',
    });
    return;
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('status, sort_seed')
    .eq('id', sessionId)
    .single();

  if (!session) {
    res.status(404).json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' });
    return;
  }
  if (session.status !== 'voting') {
    res
      .status(409)
      .json({ code: 'INVALID_STATUS', message: '투표 단계에서만 정렬을 바꿀 수 있습니다' });
    return;
  }

  // random 최초 선택 시 시드 고정(새로고침해도 순서 유지)
  const update: { sort_mode: SortMode; sort_seed?: number } = { sort_mode: sortMode as SortMode };
  if (sortMode === 'random' && session.sort_seed == null) {
    update.sort_seed = Math.floor(Date.parse(new Date().toISOString()) % 2_147_483_647) || 1;
  }

  const { error } = await supabase.from('sessions').update(update).eq('id', sessionId);
  if (error) {
    res.status(500).json({ code: 'DB_ERROR', message: error.message });
    return;
  }

  res.json({ message: '정렬 모드를 변경했습니다', sortMode });
});

export default router;
