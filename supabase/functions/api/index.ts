// NyamNyam-Together API — Supabase Edge Function (Deno + Hono)
// 모든 라우트를 단일 Edge Function에서 제공.

import { Hono } from 'npm:hono@4';
import { cors } from 'npm:hono@4/cors';
import { supabase } from '../_shared/supabase.ts';
import {
  requireAuth,
  requireToss,
  requireParticipant,
  signToken,
  signAnonToken,
} from '../_shared/auth.ts';
import { exchangeAuthorizationCode, getUserKey } from '../_shared/tossLogin.ts';
import { ensureStation, placeDetails } from '../_shared/googlePlaces.ts';
import { aggregate, checkDeadlineAndAggregate } from '../_shared/aggregation.ts';
import { finalizeSession, FinalizeError } from '../_shared/finalVote.ts';
import { applySortMode } from '../_shared/domain/sort.ts';
import type { SortMode } from '../_shared/domain/sort.ts';
import { distanceFromStation } from '../_shared/domain/geo.ts';
import type { Station } from '../_shared/domain/types.ts';
import type { PlaceSource, PlaceType } from '../_shared/database.types.ts';
import { classifyPlaceType } from '../_shared/domain/placeType.ts';
import { googleTypesForCategory } from '../_shared/domain/category.ts';

// Supabase strips /functions/v1 but keeps the function name in path.
// Requests arrive as /api/health, /api/sessions, etc.
const app = new Hono().basePath('/api');

// CORS — Toss WebView(크로스오리진)에서 호출. CORS_ORIGIN 환경변수로 허용 출처 제한 가능.
const corsOriginEnv = Deno.env.get('CORS_ORIGIN');
app.use(
  '*',
  cors({
    origin: corsOriginEnv
      ? corsOriginEnv.split(',').map((s) => s.trim())
      : '*',
  }),
);

// ── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ status: 'ok' }));

// DEBUG: 집계 직접 실행 — 에러 응답으로 반환 (임시, 프로덕션에서는 404)
app.post('/__debug_aggregate/:sessionId', async (c) => {
  if (Deno.env.get('ENV') === 'production') return c.json({ code: 'NOT_FOUND' }, 404);
  const sessionId = c.req.param('sessionId');
  const logs: string[] = [];
  try {
    const { data: session } = await supabase.from('sessions').select('status,station_id,min_participants').eq('id', sessionId).single();
    logs.push(`session: ${JSON.stringify(session)}`);
    const { count } = await supabase.from('votes').select('*', { count: 'exact', head: true }).eq('session_id', sessionId).eq('stage', 1);
    logs.push(`vote count: ${count}`);
    const { data: stMeta } = await supabase.from('station_places').select('station_lat,station_lng').eq('station_id', session?.station_id ?? '').single();
    logs.push(`stationMeta: ${JSON.stringify(stMeta)}`);
    const { data: votes } = await supabase.from('votes').select('drink,budget_min,budget_max,categories,mood,sort_pref').eq('session_id', sessionId).eq('stage', 1);
    logs.push(`votes: ${JSON.stringify(votes)}`);
    // recommend 직접 호출해서 에러 잡기
    const { recommend } = await import('../_shared/recommend.ts');
    const { buildConstraintsFromVotes, tallySortMode } = await import('../_shared/voteAggregation.ts');
    const constraints = buildConstraintsFromVotes((votes ?? []).map((v: Record<string,unknown>) => ({
      drink: v.drink as 'drinker'|'ok'|'uncomfortable' ?? 'ok',
      budget_min: v.budget_min as number|null,
      budget_max: v.budget_max as number ?? 30000,
      categories: Array.isArray(v.categories) ? v.categories as string[] : [],
      mood: v.mood as 'quiet'|'any'|null,
      sort_pref: v.sort_pref as 'review_count'|'rating'|'random'|null,
    })));
    logs.push(`constraints: ${JSON.stringify(constraints)}`);
    const station = { id: stMeta ? '철산역' : '', lat: stMeta?.station_lat ?? 0, lng: stMeta?.station_lng ?? 0 };
    const result = await recommend(sessionId, constraints, station);
    logs.push(`recommend result: ${result.recommended.length}건`);
    return c.json({ ok: true, logs });
  } catch (e) {
    const msg = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
    let errInfo: unknown;
    try { errInfo = JSON.parse(JSON.stringify(e)); } catch { errInfo = msg; }
    return c.json({ ok: false, error: errInfo, logs });
  }
});

// DEBUG: 배포 후 URL 경로 확인용 — 프로덕션에서는 404
app.all('/__debug', (c) => {
  if (Deno.env.get('ENV') === 'production') return c.json({ code: 'NOT_FOUND' }, 404);
  return c.json({ url: c.req.url, path: new URL(c.req.url).pathname, method: c.req.method });
});

// ── Auth ─────────────────────────────────────────────────────────────────────

// POST /auth/anon — 익명 참가자 토큰 발급 (링크로 입장하는 참여자용)
app.post('/auth/anon', (c) => {
  const { token } = signAnonToken();
  return c.json({ token });
});

// POST /auth/login — 토스 인가코드 → userKey → JWT 발급
app.post('/auth/login', async (c) => {
  const body = await c.req.json<{ authorizationCode?: string; referrer?: string }>();
  const { authorizationCode, referrer } = body;
  if (!authorizationCode || !referrer) {
    return c.json(
      { code: 'BAD_REQUEST', message: 'authorizationCode와 referrer가 필요합니다' },
      400,
    );
  }
  try {
    const { accessToken } = await exchangeAuthorizationCode(authorizationCode, referrer);
    const userKey = await getUserKey(accessToken);
    return c.json({ token: signToken(userKey) });
  } catch {
    return c.json({ code: 'AUTH_FAILED', message: '토스 로그인에 실패했습니다' }, 401);
  }
});

// POST /auth/dev-login — 개발 전용 테스트 토큰 (ENV=production이면 404)
app.post('/auth/dev-login', async (c) => {
  if (Deno.env.get('ENV') === 'production') {
    return c.json({ code: 'NOT_FOUND' }, 404);
  }
  const body = await c.req.json<{ userKey?: number | string }>().catch(() => ({}));
  const userKey = parseInt(String(body?.userKey ?? '1001'), 10);
  if (isNaN(userKey) || userKey <= 0) {
    return c.json({ code: 'BAD_REQUEST', message: 'userKey는 양수 정수여야 합니다' }, 400);
  }
  return c.json({ token: signToken(userKey), userKey });
});

// ── Stations ─────────────────────────────────────────────────────────────────

// GET /stations — 권역·역 목록 (세션 생성 화면 역 선택용 큐레이션 고정 목록)
app.get('/stations', async (c) => {
  const regions = [
    { id: 'gangnam', name: '강남·서초·송파', stations: ['강남역','신논현역','양재역','교대역','서초역','잠실역','삼성역','선릉역','가락시장역'], lat: 37.497, lng: 127.027 },
    { id: 'yongsan', name: '용산·마포·서대문', stations: ['용산역','이태원역','홍대입구역','합정역','공덕역','신촌역'], lat: 37.530, lng: 126.960 },
    { id: 'jongno', name: '종로·동대문', stations: ['종로3가역','광화문역','동대문역','동대문역사문화공원역','혜화역'], lat: 37.571, lng: 126.990 },
    { id: 'seongsu', name: '성수·건대입구', stations: ['성수역','건대입구역','뚝섬역','왕십리역'], lat: 37.544, lng: 127.056 },
    { id: 'gwanak', name: '관악·영등포', stations: ['서울대입구역','신림역','영등포역','여의도역','당산역'], lat: 37.481, lng: 126.952 },
    { id: 'incheon', name: '인천', stations: ['인천역','동인천역','부평역','주안역','송도역','인천터미널역'], lat: 37.476, lng: 126.617 },
    { id: 'gwangmyeong', name: '광명', stations: ['광명사거리역','철산역','광명역'], lat: 37.478, lng: 126.864 },
  ];

  const { data: stationRows } = await supabase
    .from('station_places')
    .select('station_id, station_lat, station_lng');

  const coordMap = new Map(
    (stationRows ?? []).map((r) => [r.station_id, { lat: Number(r.station_lat), lng: Number(r.station_lng) }]),
  );

  return c.json({
    regions: regions.map((region, ri) => ({
      id: region.id,
      name: region.name,
      stations: region.stations.map((name, si) => {
        const coords = coordMap.get(name);
        return {
          id: name,
          lat: coords?.lat ?? region.lat + si * 0.003,
          lng: coords?.lng ?? region.lng + si * 0.003,
        };
      }),
    })),
  });
});

// ── Sessions ──────────────────────────────────────────────────────────────────

// POST /sessions — 모임 생성
app.post('/sessions', requireToss, async (c) => {
  const userKey = c.get('userKey') as number;
  const body = await c.req.json<{
    stationId?: string;
    stationLat?: number;
    stationLng?: number;
    title?: string;
    minParticipants?: number;
    purpose?: string;
    deadline?: string;
  }>();

  const { stationId, stationLat, stationLng, title, minParticipants, purpose, deadline } = body;
  if (!stationId || !title) {
    return c.json({ code: 'BAD_REQUEST', message: 'stationId, title이 필요합니다' }, 400);
  }

  if (stationLat != null && stationLng != null) {
    await ensureStation(stationId, stationLat, stationLng);
  } else {
    const { data: st } = await supabase
      .from('station_places')
      .select('station_id')
      .eq('station_id', stationId)
      .maybeSingle();
    if (!st) {
      return c.json(
        { code: 'UNKNOWN_STATION', message: '등록되지 않은 역입니다. 주요 역에서 선택해주세요' },
        400,
      );
    }
  }

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      host_user_key: userKey,
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
    return c.json({ code: 'DB_ERROR', message: '세션 생성에 실패했습니다' }, 500);
  }

  const { error: pErr } = await supabase
    .from('participants')
    .insert({ session_id: data.id, user_key: userKey });
  if (pErr) {
    console.error('호스트 participants 삽입 실패:', pErr);
    return c.json({ code: 'DB_ERROR', message: '세션 생성에 실패했습니다' }, 500);
  }
  return c.json({ sessionId: data.id, inviteLink: `/sessions/${data.id}/join` }, 201);
});

// GET /sessions/:id — 모임 정보
app.get('/sessions/:id', requireAuth, async (c) => {
  const sessionId = c.req.param('id');
  await checkDeadlineAndAggregate(sessionId);

  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    return c.json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' }, 404);
  }

  const { count } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  return c.json({ ...session, participantCount: count ?? 0 });
});

// POST /sessions/:id/close — 생성자 수동 종료
app.post('/sessions/:id/close', requireToss, async (c) => {
  const sessionId = c.req.param('id');
  const userKey = c.get('userKey') as number;

  const { data: session, error } = await supabase
    .from('sessions')
    .select('host_user_key, status')
    .eq('id', sessionId)
    .single();

  if (error || !session) return c.json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' }, 404);
  if (session.host_user_key !== userKey)
    return c.json({ code: 'FORBIDDEN', message: '생성자만 종료할 수 있습니다' }, 403);
  if (session.status !== 'collecting')
    return c.json(
      { code: 'INVALID_STATUS', message: '투표 수집 중인 상태에서만 종료할 수 있습니다' },
      409,
    );

  await aggregate(sessionId);
  return c.json({ message: '집계를 시작했습니다' });
});

// POST /sessions/:id/finalize — stage2 최종 집계
app.post('/sessions/:id/finalize', requireToss, async (c) => {
  const sessionId = c.req.param('id');
  const userKey = c.get('userKey') as number;
  const body = await c.req.json<{ forceWinnerId?: string }>().catch(() => ({}));

  const { data: session } = await supabase
    .from('sessions')
    .select('host_user_key')
    .eq('id', sessionId)
    .single();

  if (!session) return c.json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' }, 404);
  if (session.host_user_key !== userKey)
    return c.json({ code: 'FORBIDDEN', message: '생성자만 집계할 수 있습니다' }, 403);

  try {
    const result = await finalizeSession(sessionId, body?.forceWinnerId);
    return c.json(result);
  } catch (err) {
    if (err instanceof FinalizeError) {
      return c.json({ code: err.code, message: err.message }, err.status as 400 | 404 | 409);
    }
    throw err;
  }
});

// GET /sessions/:id/progress — N/정원 응답 현황
// 호스트도 완전한 참여자(취향 입력)이므로 인원 집계에 포함한다.
// min(= 최대 인원/정원)도 함께 내려 프론트가 정원 대비 진행률을 표시한다.
app.get('/sessions/:id/progress', requireAuth, async (c) => {
  const sessionId = c.req.param('id');

  const { data: session } = await supabase
    .from('sessions')
    .select('min_participants')
    .eq('id', sessionId)
    .single();

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

  return c.json({
    responded: responded ?? 0,
    total: total ?? 0,
    min: session?.min_participants ?? 0,
  });
});

// ── Participants ──────────────────────────────────────────────────────────────

// POST /sessions/:id/join
app.post('/sessions/:id/join', requireAuth, async (c) => {
  const sessionId = c.req.param('id');
  const userKey = c.get('userKey') as number;

  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (!session) return c.json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' }, 404);
  if (session.status !== 'collecting')
    return c.json(
      { code: 'INVALID_STATUS', message: '투표 수집 중인 세션에만 참여할 수 있습니다' },
      409,
    );

  const { error } = await supabase
    .from('participants')
    .insert({ session_id: sessionId, user_key: userKey });

  if (error?.code === '23505')
    return c.json({ code: 'ALREADY_JOINED', message: '이미 참여한 세션입니다' }, 409);
  if (error) return c.json({ code: 'DB_ERROR', message: error.message }, 500);

  return c.json({ message: '참여가 완료됐습니다' }, 201);
});

// ── Votes ─────────────────────────────────────────────────────────────────────

async function isParticipant(sessionId: string, userKey: number): Promise<boolean> {
  const { data } = await supabase
    .from('participants')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_key', userKey)
    .single();
  return data != null;
}

// POST /sessions/:id/votes/stage1
app.post('/sessions/:id/votes/stage1', requireAuth, async (c) => {
  const sessionId = c.req.param('id');
  const userKey = c.get('userKey') as number;
  const body = await c.req.json<{
    drink?: string;
    budgetMin?: number;
    budgetMax?: number;
    categories?: string[];
    mood?: string;
    sortPref?: string;
  }>();

  const { drink, budgetMin, budgetMax, categories = [], mood, sortPref } = body;
  if (!drink || budgetMax == null)
    return c.json({ code: 'BAD_REQUEST', message: 'drink과 budgetMax가 필요합니다' }, 400);
  if (!['drinker', 'ok', 'uncomfortable'].includes(drink))
    return c.json(
      { code: 'BAD_REQUEST', message: 'drink은 drinker/ok/uncomfortable 중 하나여야 합니다' },
      400,
    );
  if (mood && !['quiet', 'any'].includes(mood))
    return c.json({ code: 'BAD_REQUEST', message: 'mood는 quiet/any 중 하나여야 합니다' }, 400);
  if (sortPref && !SORT_MODES.includes(sortPref as SortMode))
    return c.json(
      { code: 'BAD_REQUEST', message: 'sortPref는 review_count/rating/random 중 하나여야 합니다' },
      400,
    );

  const { data: session } = await supabase
    .from('sessions')
    .select('status, min_participants')
    .eq('id', sessionId)
    .single();

  if (!session) return c.json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' }, 404);
  if (session.status !== 'collecting')
    return c.json(
      { code: 'INVALID_STATUS', message: '투표 수집 중인 세션에만 응답할 수 있습니다' },
      409,
    );
  if (!(await isParticipant(sessionId, userKey)))
    return c.json(
      { code: 'NOT_PARTICIPANT', message: '세션에 참여한 사용자만 응답할 수 있습니다' },
      403,
    );

  const { error } = await supabase.from('votes').insert({
    session_id: sessionId,
    user_key: userKey,
    stage: 1,
    drink: drink as 'drinker' | 'ok' | 'uncomfortable',
    budget_min: budgetMin ?? null,
    budget_max: budgetMax,
    categories,
    mood: (mood as 'quiet' | 'any' | undefined) ?? null,
    sort_pref: (sortPref as SortMode | undefined) ?? null,
  });

  if (error?.code === '23505')
    return c.json({ code: 'ALREADY_VOTED', message: '이미 응답한 세션입니다' }, 409);
  if (error) return c.json({ code: 'DB_ERROR', message: error.message }, 500);

  // 정원(min_participants = 최대 인원) 전원이 응답하면 자동 집계.
  const { count } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('stage', 1);
  if ((count ?? 0) >= (session.min_participants ?? 0)) {
    await aggregate(sessionId);
  }

  return c.json({ message: '응답이 완료됐습니다' }, 201);
});

// POST /sessions/:id/votes/stage2
app.post('/sessions/:id/votes/stage2', requireAuth, async (c) => {
  const sessionId = c.req.param('id');
  const userKey = c.get('userKey') as number;
  const body = await c.req.json<{ restaurantId?: string }>();

  if (!body.restaurantId)
    return c.json({ code: 'BAD_REQUEST', message: 'restaurantId가 필요합니다' }, 400);

  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single();

  if (!session) return c.json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' }, 404);
  if (session.status !== 'voting')
    return c.json(
      { code: 'INVALID_STATUS', message: '투표 단계에서만 식당을 선택할 수 있습니다' },
      409,
    );
  if (!(await isParticipant(sessionId, userKey)))
    return c.json(
      { code: 'NOT_PARTICIPANT', message: '세션에 참여한 사용자만 투표할 수 있습니다' },
      403,
    );

  const { data: rec } = await supabase
    .from('recommendations')
    .select('id')
    .eq('session_id', sessionId)
    .eq('id', body.restaurantId)
    .single();

  if (!rec)
    return c.json({ code: 'NOT_FOUND', message: '해당 후보 식당을 찾을 수 없습니다' }, 404);

  const { error } = await supabase.from('votes').insert({
    session_id: sessionId,
    user_key: userKey,
    stage: 2,
    recommendation_id: body.restaurantId,
  });

  if (error?.code === '23505')
    return c.json({ code: 'ALREADY_VOTED', message: '이미 투표했습니다' }, 409);
  if (error) return c.json({ code: 'DB_ERROR', message: error.message }, 500);

  return c.json({ message: '투표가 완료됐습니다' }, 201);
});

// ── Recommendations ───────────────────────────────────────────────────────────

const DISPLAY_COUNT = 4;
const SORT_MODES: SortMode[] = ['review_count', 'rating', 'random'];
const ATTRIBUTION = 'Powered by Google';

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

// GET /sessions/:id/recommendations
app.get('/sessions/:id/recommendations', requireParticipant, async (c) => {
  const sessionId = c.req.param('id');
  await checkDeadlineAndAggregate(sessionId);

  const { data: session } = await supabase
    .from('sessions')
    .select('status, sort_mode, sort_seed, station_id')
    .eq('id', sessionId)
    .single();

  if (!session) return c.json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' }, 404);
  if (['collecting', 'aggregating'].includes(session.status)) {
    return c.json({ code: 'NOT_READY', message: '아직 집계 전입니다', status: session.status }, 202);
  }

  const [stationRow, recsRes, stage2Votes] = await Promise.all([
    supabase
      .from('station_places')
      .select('station_lat, station_lng')
      .eq('station_id', session.station_id)
      .single()
      .then(({ data }) => data),
    supabase
      .from('recommendations')
      .select(
        'id, place_id, place_type, rank, relaxed, review_count_at_agg, rating_at_agg, ' +
          'places(source, google_place_id, name, category, price_level, lat, lng)',
      )
      .eq('session_id', sessionId)
      .order('rank', { ascending: true }),
    supabase
      .from('votes')
      .select('recommendation_id')
      .eq('session_id', sessionId)
      .eq('stage', 2)
      .then(({ data }) => data),
  ]);

  const station: Station | null = stationRow
    ? { id: session.station_id, lat: Number(stationRow.station_lat), lng: Number(stationRow.station_lng) }
    : null;

  if (recsRes.error) {
    console.error('recommendations 조회 실패:', recsRes.error);
    return c.json({ code: 'DB_ERROR', message: '추천을 불러오지 못했습니다' }, 500);
  }

  const rows = (recsRes.data ?? []) as unknown as RecRow[];
  const queryMode = c.req.query('sort') as SortMode | undefined;
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

  const googleIds = sorted
    .map((r) => r.places?.google_place_id)
    .filter((id): id is string => typeof id === 'string');
  const details = await placeDetails(googleIds);

  const voteCounts: Record<string, number> = {};
  for (const v of stage2Votes ?? []) {
    if (v.recommendation_id)
      voteCounts[v.recommendation_id] = (voteCounts[v.recommendation_id] ?? 0) + 1;
  }

  const result = sorted.map((r) => {
    const isGoogle = r.places?.source === 'google';
    const live = r.places?.google_place_id ? details.get(r.places.google_place_id) : undefined;
    const lat = isGoogle ? (live?.lat ?? null) : (r.places?.lat ?? null);
    const lng = isGoogle ? (live?.lng ?? null) : (r.places?.lng ?? null);
    const distanceM = station ? distanceFromStation({ lat, lng }, station) : null;
    return {
      recId: r.id,
      placeId: r.places?.google_place_id ?? r.place_id,
      rank: r.rank,
      placeType: r.place_type,
      relaxed: r.relaxed,
      source: r.places?.source ?? null,
      name: live?.name ?? r.places?.name ?? null,
      category: isGoogle ? (live?.category ?? r.places?.category ?? null) : (r.places?.category ?? null),
      imageUrl: live?.imageUrl ?? null,
      rating: live?.rating ?? r.rating_at_agg,
      reviewCount: live?.userRatingCount ?? r.review_count_at_agg,
      priceLevel: live?.priceLevel ?? r.places?.price_level ?? null,
      distanceM,
      address: live?.address ?? null,
      phone: live?.phone ?? null,
      mapUrl: live?.mapUrl ?? null,
      voteCount: voteCounts[r.id] ?? 0,
      poweredByGoogle: isGoogle,
    };
  });

  const leader = result.reduce<{ recId: string; voteCount: number } | null>((best, c) => {
    if (c.voteCount <= 0) return best;
    return !best || c.voteCount > best.voteCount
      ? { recId: c.recId, voteCount: c.voteCount }
      : best;
  }, null);

  return c.json({ sortMode: mode, relaxed: result.some((r) => r.relaxed), attribution: ATTRIBUTION, leader, recommendations: result });
});

// PATCH /sessions/:id/sort — 정렬 모드 변경
// 정렬 모드는 호스트만 지정한다(참여자가 서로 덮어쓰는 경쟁 상태 방지). requireToss + 생성자 확인.
app.patch('/sessions/:id/sort', requireToss, async (c) => {
  const sessionId = c.req.param('id');
  const userKey = c.get('userKey') as number;
  const body = await c.req.json<{ sortMode?: string }>();

  if (!body.sortMode || !SORT_MODES.includes(body.sortMode as SortMode)) {
    return c.json(
      { code: 'BAD_REQUEST', message: 'sortMode는 review_count/rating/random 중 하나여야 합니다' },
      400,
    );
  }
  const sortMode = body.sortMode as SortMode;

  const { data: session } = await supabase
    .from('sessions')
    .select('status, sort_seed, host_user_key')
    .eq('id', sessionId)
    .single();

  if (!session) return c.json({ code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' }, 404);
  if (session.host_user_key !== userKey)
    return c.json({ code: 'FORBIDDEN', message: '생성자만 정렬을 바꿀 수 있습니다' }, 403);
  if (session.status !== 'voting')
    return c.json(
      { code: 'INVALID_STATUS', message: '투표 단계에서만 정렬을 바꿀 수 있습니다' },
      409,
    );

  const update: { sort_mode: SortMode; sort_seed?: number } = { sort_mode: sortMode };
  if (sortMode === 'random' && session.sort_seed == null) {
    // Web Crypto API — crypto.getRandomValues로 안전한 시드 생성 (Node randomInt 대체)
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    update.sort_seed = (arr[0] % 2_147_483_646) + 1;
  }

  const { error } = await supabase.from('sessions').update(update).eq('id', sessionId);
  if (error) return c.json({ code: 'DB_ERROR', message: '정렬 변경에 실패했습니다' }, 500);

  return c.json({ message: '정렬 모드를 변경했습니다', sortMode });
});

// ── Places ────────────────────────────────────────────────────────────────────

const SOURCES: PlaceSource[] = ['owner', 'community'];
const PLACE_TYPES: PlaceType[] = ['drink_required', 'compatible', 'general'];

// POST /places — 점주/시민 식당 등록 (토스 로그인 필수 — 익명 토큰 불가)
app.post('/places', requireToss, async (c) => {
  const body = await c.req.json<{
    source?: string;
    stationId?: string;
    name?: string;
    lat?: number;
    lng?: number;
    category?: string;
    priceLevel?: number;
    openDate?: string;
    placeType?: string;
  }>();

  const { source, stationId, name, lat, lng, category, priceLevel, openDate, placeType } = body;

  if (!source || !SOURCES.includes(source as PlaceSource))
    return c.json(
      { code: 'BAD_REQUEST', message: 'source는 owner/community 중 하나여야 합니다' },
      400,
    );
  if (!stationId || !name || lat == null || lng == null)
    return c.json(
      { code: 'BAD_REQUEST', message: 'stationId, name, lat, lng가 필요합니다' },
      400,
    );
  if (priceLevel != null && (priceLevel < 1 || priceLevel > 4))
    return c.json({ code: 'BAD_REQUEST', message: 'priceLevel은 1~4여야 합니다' }, 400);
  if (placeType && !PLACE_TYPES.includes(placeType as PlaceType))
    return c.json({ code: 'BAD_REQUEST', message: 'placeType이 올바르지 않습니다' }, 400);

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
      place_type:
        (placeType as PlaceType | undefined) ??
        classifyPlaceType(googleTypesForCategory(category ?? '')),
      status: 'active',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('place 등록 실패:', error);
    return c.json({ code: 'DB_ERROR', message: '등록에 실패했습니다' }, 500);
  }
  return c.json({ placeId: data.id }, 201);
});

// GET /places?stationId= — 역의 등록 식당 목록
app.get('/places', requireAuth, async (c) => {
  const stationId = c.req.query('stationId');
  if (!stationId)
    return c.json({ code: 'BAD_REQUEST', message: 'stationId 쿼리가 필요합니다' }, 400);

  const { data, error } = await supabase
    .from('places')
    .select('id, source, name, lat, lng, category, price_level, open_date, place_type, status')
    .eq('station_id', stationId)
    .in('source', ['owner', 'community']);

  if (error) {
    console.error('places 목록 조회 실패:', error);
    return c.json({ code: 'DB_ERROR', message: '목록을 불러오지 못했습니다' }, 500);
  }
  return c.json({ places: data ?? [] });
});

// 공통 에러 핸들러
app.onError((err, c) => {
  console.error(err);
  return c.json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' }, 500);
});

export default { fetch: app.fetch.bind(app) };
