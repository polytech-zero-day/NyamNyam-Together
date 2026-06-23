// 구글 Places API(New) 미들웨어 (google-places-api.md)
// ⚠️ 서버만 호출(키 보호). ToS: place_id만 영구 저장, 그 외 콘텐츠는 라이브 후 세션 내 사용·폐기.
// ⚠️ Enterprise 필드마스크 단일 호출 고정. Atmosphere 필드(reviews/editorialSummary/servesXxx/
//    goodForGroups 등) 절대 요청 금지.

import axios from 'axios';
import { supabase } from '../config/supabase';
import { classifyPlaceType } from '../domain/placeType';
import type { Candidate, Station } from '../domain/types';

const PLACES_BASE = 'https://places.googleapis.com/v1';
const DISCOVERY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일 (역 재탐색 주기)
const DEFAULT_RADIUS_M = 500;
const NEARBY_MAX_RESULTS = 20; // 결과 최대 20, 페이지네이션 없음

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!GOOGLE_PLACES_API_KEY) throw new Error('GOOGLE_PLACES_API_KEY must be set');

// Nearby Search field mask — Enterprise 단일 호출 (google-places-api.md).
// ❌ reviews/editorialSummary/servesXxx/goodForGroups 등 Atmosphere 필드 금지.
const NEARBY_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.types',
  'places.primaryType',
  'places.location',
  'places.formattedAddress',
  'places.businessStatus',
  'places.openingDate',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
].join(',');

const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'types',
  'primaryType',
  'location',
  'formattedAddress',
  'businessStatus',
  'rating',
  'userRatingCount',
  'priceLevel',
].join(',');

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  types?: string[];
  primaryType?: string;
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string; // PRICE_LEVEL_* enum
  movedPlaceId?: string;
}

// 구글 priceLevel enum → 1~4 (없으면 null → 예산 필터 미적용)
function mapPriceLevel(level?: string): number | null {
  switch (level) {
    case 'PRICE_LEVEL_FREE':
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 1;
    case 'PRICE_LEVEL_MODERATE':
      return 2;
    case 'PRICE_LEVEL_EXPENSIVE':
      return 3;
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 4;
    default:
      return null;
  }
}

// 하버사인 거리(m) — Nearby는 distance를 주지 않으므로 역 좌표 기준 계산
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function toCandidate(p: GooglePlace, station: Station, placeId: string | null): Candidate {
  const loc = p.location;
  return {
    ref: p.id,
    placeId,
    source: 'google',
    types: p.types ?? [],
    primaryType: p.primaryType ?? null,
    priceLevel: mapPriceLevel(p.priceLevel),
    rating: p.rating ?? null,
    userRatingCount: p.userRatingCount ?? null,
    name: p.displayName?.text ?? null, // 라이브 표시용(미저장)
    distanceM: loc ? haversineM(station.lat, station.lng, loc.latitude, loc.longitude) : null,
    placeTypeOverride: null,
    categoryKorean: null,
    openDate: null, // 구글 openingDate는 미래 개업 전용 → longevity 미적용
  };
}

// Nearby Search (New) — 라이브 후보 수집. POPULARITY 정렬, Enterprise 필드마스크.
async function nearbySearch(station: Station, radiusM: number): Promise<GooglePlace[]> {
  const res = await axios.post(
    `${PLACES_BASE}/places:searchNearby`,
    {
      includedPrimaryTypes: ['restaurant'], // 음식점군 한정 (세부 타입은 domain category 매핑)
      maxResultCount: NEARBY_MAX_RESULTS,
      rankPreference: 'POPULARITY',
      locationRestriction: {
        circle: {
          center: { latitude: station.lat, longitude: station.lng },
          radius: radiusM,
        },
      },
    },
    {
      headers: {
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': NEARBY_FIELD_MASK,
        'Content-Type': 'application/json',
      },
    },
  );
  return (res.data.places ?? []) as GooglePlace[];
}

/**
 * 역 좌표 등록 (세션 생성 시 호출). station_places가 없으면 INSERT, 있으면 유지.
 * (이전 kakao.ensureStationExists 대체 — 우리 station_places 소유)
 */
export async function ensureStation(stationId: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase
    .from('station_places')
    .upsert(
      { station_id: stationId, station_lat: lat, station_lng: lng },
      { onConflict: 'station_id', ignoreDuplicates: true },
    );
  // 조용히 넘어가면 후속 FK(예: sessions/places.station_id)가 모호한 에러로 터진다 → 원인을 즉시 표면화.
  if (error) throw error;
}

/**
 * place_id 디스커버리 + 라이브 후보 반환 (google-places-api.md 캐싱 전략).
 * - station_places TTL(30일) 만료/최초면 Nearby 라이브 호출 → places에 place_id만 upsert.
 * - 콘텐츠는 저장하지 않고 라이브 응답을 그대로 파이프라인 입력으로 반환.
 * - upsert 후 각 후보의 내부 places.id(placeId)를 채워 반환.
 *
 * @returns 라이브 google 후보 배열 (placeId 매핑 포함)
 */
export async function discoverAndFetch(
  station: Station,
  radiusM: number = DEFAULT_RADIUS_M,
): Promise<Candidate[]> {
  const places = await nearbySearch(station, radiusM);

  // 영업 종료(CLOSED_PERMANENTLY) 제외, movedPlaceId 있으면 교체 (google-places-api.md stale 처리)
  const live = places
    .filter((p) => p.businessStatus !== 'CLOSED_PERMANENTLY')
    .map((p) => ({ ...p, id: p.movedPlaceId ?? p.id }));

  // place_id + place_type(가공값)만 upsert. 구글 콘텐츠(이름·평점·가격 등)는 저장 안 함(ToS).
  // place_type은 google types를 우리 분류로 가공한 값이라 저장 허용 (db-schema.md places.place_type).
  if (live.length > 0) {
    const rows = live.map((p) => ({
      source: 'google' as const,
      google_place_id: p.id,
      station_id: station.id,
      place_type: classifyPlaceType(p.types ?? [], p.primaryType ?? null),
    }));
    await supabase.from('places').upsert(rows, { onConflict: 'google_place_id' });
  }

  // station_places 디스커버리 메타 갱신
  await supabase
    .from('station_places')
    .update({ places_discovered_at: new Date().toISOString(), place_count: live.length })
    .eq('station_id', station.id);

  // 내부 places.id 매핑 조회 (recommendations FK용)
  const ids = live.map((p) => p.id);
  const { data: placeRows } = await supabase
    .from('places')
    .select('id, google_place_id')
    .in('google_place_id', ids);
  const idByGoogle = new Map((placeRows ?? []).map((r) => [r.google_place_id, r.id]));

  return live.map((p) => toCandidate(p, station, idByGoogle.get(p.id) ?? null));
}

// station_places의 디스커버리 신선도 확인 (선택적 사용 — 강제 재탐색 판단용)
export async function isDiscoveryStale(stationId: string): Promise<boolean> {
  const { data } = await supabase
    .from('station_places')
    .select('places_discovered_at')
    .eq('station_id', stationId)
    .single();
  if (!data?.places_discovered_at) return true;
  return Date.now() - new Date(data.places_discovered_at).getTime() > DISCOVERY_TTL_MS;
}

/**
 * Place Details (New) — 최종 후보 3~4곳 표시용 라이브 조회 (소수라 저렴).
 * 전체 리스트엔 쓰지 않는다. 반환은 google_place_id → 표시 데이터.
 */
export interface PlaceDisplay {
  ref: string;
  name: string | null;
  types: string[];
  primaryType: string | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: number | null;
  address: string | null;
}

export async function placeDetails(googlePlaceIds: string[]): Promise<Map<string, PlaceDisplay>> {
  const out = new Map<string, PlaceDisplay>();
  await Promise.all(
    googlePlaceIds.map(async (id) => {
      try {
        const res = await axios.get(`${PLACES_BASE}/places/${id}`, {
          headers: {
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': DETAILS_FIELD_MASK,
          },
        });
        const p = res.data as GooglePlace;
        out.set(id, {
          ref: id,
          name: p.displayName?.text ?? null,
          types: p.types ?? [],
          primaryType: p.primaryType ?? null,
          rating: p.rating ?? null,
          userRatingCount: p.userRatingCount ?? null,
          priceLevel: mapPriceLevel(p.priceLevel),
          address: p.formattedAddress ?? null,
        });
      } catch {
        // 개별 실패는 무시(표시 데이터 없으면 스냅샷 폴백). 집계는 멈추지 않는다.
      }
    }),
  );
  return out;
}
