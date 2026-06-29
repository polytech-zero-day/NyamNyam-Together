import { supabase } from './supabase.ts';
import { discoverAndFetch } from './googlePlaces.ts';
import { runPipeline } from './domain/pipeline.ts';
import type { PipelineResult } from './domain/pipeline.ts';
import { distanceFromStation } from './domain/geo.ts';
import { getEligibleCategories, googleTypesForCategory } from './domain/category.ts';
import type { AggregatedConstraints, Candidate, Station, RankedCandidate } from './domain/types.ts';

const RELAXED_RADIUS_M = 1_000;
const MIN_GOOGLE_CANDS = 6; // 카테고리로 좁혔을 때 이보다 적으면 전체 검색으로 보충

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
  const { error } = await supabase
    .from('recommendations')
    .upsert(rows, { onConflict: 'session_id,place_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function recommend(
  sessionId: string,
  constraints: AggregatedConstraints,
  station: Station,
): Promise<PipelineResult> {
  // 채택된 음식 카테고리(1표 이상)의 구글 type으로 검색을 좁혀 취향에 맞는 후보를 모은다.
  const includedTypes = [
    ...new Set(getEligibleCategories(constraints.categories).flatMap(googleTypesForCategory)),
  ];

  console.log(`[recommend] sessionId=${sessionId} station=${station.id} includedTypes=${JSON.stringify(includedTypes)}`);
  const [gRes, rRes] = await Promise.allSettled([
    discoverAndFetch(station, undefined, true, includedTypes),
    fetchRegisteredCandidates(station),
  ]);
  if (gRes.status === 'rejected')
    console.error('구글 Nearby 실패 — 등록 식당만으로 진행:', gRes.reason);
  if (rRes.status === 'rejected') console.error('등록 식당 조회 실패:', rRes.reason);
  let googleCands = gRes.status === 'fulfilled' ? gRes.value : [];
  const registered = rRes.status === 'fulfilled' ? rRes.value : [];

  // 카테고리로 좁혀 후보가 부족하면 전체 음식점 검색으로 보충(매칭 후보는 +10점으로 여전히 우선).
  if (includedTypes.length > 0 && googleCands.length < MIN_GOOGLE_CANDS) {
    try {
      const generic = await discoverAndFetch(station, undefined, false, []);
      const seen = new Set(googleCands.map((c) => c.placeId));
      googleCands = [
        ...googleCands,
        ...generic.filter((c) => c.placeId != null && !seen.has(c.placeId)),
      ];
    } catch (e) {
      console.error('보충(전체) 검색 실패:', e);
    }
  }

  console.log(`[recommend] googleCands=${googleCands.length} registered=${registered.length}`);
  let result = runPipeline([...googleCands, ...registered], constraints);

  if (result.recommended.length === 0 && result.relaxedConstraints.includes('radius')) {
    try {
      const wider = await discoverAndFetch(station, RELAXED_RADIUS_M, false, includedTypes);
      result = runPipeline([...wider, ...registered], constraints);
      result.recommended = result.recommended.map((c) => ({ ...c, relaxed: true }));
    } catch (e) {
      console.error('반경 완화 검색 실패 — 현재 후보 유지:', e);
    }
  }

  console.log(`[recommend] result.recommended=${result.recommended.length} relaxed=${JSON.stringify(result.relaxedConstraints)}`);
  await writeRecommendations(sessionId, result.recommended);
  return result;
}
