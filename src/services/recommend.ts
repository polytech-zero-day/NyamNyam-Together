// 추천 오케스트레이션 (C 파트, api-spec.md 내부 트리거)
// 입력: AggregatedConstraints(B가 집계) + Station → 구글 Nearby 라이브 + 등록 식당 합쳐
//       파이프라인 → recommendations 작성. (AI/ai_reason 없음 — 선정은 코드가 끝낸다)
// ⚠️ 상태전환·votes 집계는 B 소유. 이 서비스는 "집계된 제약"을 입력으로 받을 뿐이다.

import { supabase } from '../config/supabase';
import { discoverAndFetch } from './googlePlaces';
import { runPipeline, PipelineResult } from '../domain/pipeline';
import { distanceFromStation } from '../domain/geo';
import type { AggregatedConstraints, Candidate, Station, RankedCandidate } from '../domain/types';

const RELAXED_RADIUS_M = 1_000; // 0개 완화 시 반경 확대 1회 재호출 (TODO: 데이터 보고 확정)

// 등록(owner/community) 식당을 후보로 적재
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
      rating: null, // 등록 식당은 구글 평점 없음
      userRatingCount: null,
      name: r.name,
      // 역 좌표 기준 거리 계산(yang geo 흡수). 좌표 없으면 null.
      distanceM: distanceFromStation({ lat: r.lat, lng: r.lng }, station),
      placeTypeOverride: (r.place_type as Candidate['placeTypeOverride']) ?? null,
      categoryKorean: r.category,
      openDate: r.open_date,
    }));
}

async function writeRecommendations(sessionId: string, ranked: RankedCandidate[]): Promise<void> {
  if (ranked.length === 0) return;

  const rows = ranked
    .filter((c) => c.placeId !== null) // place 참조 필수(FK)
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

/**
 * 집계된 제약으로 추천 후보를 생성·작성한다. (B 상태전환에서 호출)
 * 트리거 방식(내부 함수 호출 vs HTTP)은 B 합류 형태에 따라 병합 시 확정.
 */
export async function recommend(
  sessionId: string,
  constraints: AggregatedConstraints,
  station: Station,
): Promise<PipelineResult> {
  const [googleCands, registered] = await Promise.all([
    discoverAndFetch(station),
    fetchRegisteredCandidates(station),
  ]);

  let result = runPipeline([...googleCands, ...registered], constraints);

  // 0개 완화 마지막 단계: 반경 확대 1회 재호출 (술 제약 유지, relaxed 플래그)
  if (result.recommended.length === 0 && result.relaxedConstraints.includes('radius')) {
    const wider = await discoverAndFetch(station, RELAXED_RADIUS_M);
    result = runPipeline([...wider, ...registered], constraints);
    result.recommended = result.recommended.map((c) => ({ ...c, relaxed: true }));
  }

  await writeRecommendations(sessionId, result.recommended);
  return result;
}
