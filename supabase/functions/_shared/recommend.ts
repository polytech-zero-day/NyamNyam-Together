import { supabase } from './supabase.ts';
import { discoverAndFetch } from './googlePlaces.ts';
import { runPipeline } from './domain/pipeline.ts';
import type { PipelineResult } from './domain/pipeline.ts';
import { distanceFromStation } from './domain/geo.ts';
import type { AggregatedConstraints, Candidate, Station, RankedCandidate } from './domain/types.ts';

const RELAXED_RADIUS_M = 1_000;

async function fetchRegisteredCandidates(station: Station): Promise<Candidate[]> {
  const { data, error } = await supabase
    .from('places')
    .select('id, source, place_type, name, lat, lng, category, price_level, open_date, status')
    .eq('station_id', station.id)
    .in('source', ['owner', 'community']);
  if (error) throw error;

  return (data ?? [])
    .filter((r) => r.status !== 'closed')
    .map((r) => ({
      ref: r.id,
      placeId: r.id,
      source: r.source as 'owner' | 'community',
      types: [],
      primaryType: null,
      priceLevel: r.price_level,
      rating: null,
      userRatingCount: null,
      name: r.name,
      distanceM: distanceFromStation({ lat: r.lat, lng: r.lng }, station),
      placeTypeOverride: (r.place_type as Candidate['placeTypeOverride']) ?? null,
      categoryKorean: r.category,
      openDate: r.open_date,
    }));
}

async function writeRecommendations(sessionId: string, ranked: RankedCandidate[]): Promise<void> {
  if (ranked.length === 0) return;
  const rows = ranked
    .filter((c) => c.placeId !== null)
    .map((c) => ({
      session_id: sessionId,
      place_id: c.placeId as string,
      place_type: c.placeType,
      rank: c.rank,
      relaxed: c.relaxed,
      review_count_at_agg: c.reviewCountAtAgg,
      rating_at_agg: c.ratingAtAgg,
    }));
  const { error } = await supabase.from('recommendations').insert(rows);
  if (error) throw error;
}

export async function recommend(
  sessionId: string,
  constraints: AggregatedConstraints,
  station: Station,
): Promise<PipelineResult> {
  const [gRes, rRes] = await Promise.allSettled([
    discoverAndFetch(station),
    fetchRegisteredCandidates(station),
  ]);
  if (gRes.status === 'rejected')
    console.error('구글 Nearby 실패 — 등록 식당만으로 진행:', gRes.reason);
  if (rRes.status === 'rejected') console.error('등록 식당 조회 실패:', rRes.reason);
  const googleCands = gRes.status === 'fulfilled' ? gRes.value : [];
  const registered = rRes.status === 'fulfilled' ? rRes.value : [];

  let result = runPipeline([...googleCands, ...registered], constraints);

  if (result.recommended.length === 0 && result.relaxedConstraints.includes('radius')) {
    const wider = await discoverAndFetch(station, RELAXED_RADIUS_M, false);
    result = runPipeline([...wider, ...registered], constraints);
    result.recommended = result.recommended.map((c) => ({ ...c, relaxed: true }));
  }

  await writeRecommendations(sessionId, result.recommended);
  return result;
}
