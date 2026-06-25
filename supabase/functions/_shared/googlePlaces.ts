// 구글 Places API(New) 미들웨어 — Deno Edge Function 버전
// ⚠️ 서버만 호출(키 보호). ToS: place_id만 영구 저장, 그 외 콘텐츠는 라이브 후 세션 내 사용·폐기.
// ⚠️ Enterprise 필드마스크 단일 호출 고정. Atmosphere 필드 절대 요청 금지.
// Note: Edge Function은 stateless이므로 in-memory detailsCache 없음(호출마다 라이브 조회).

import { supabase } from './supabase.ts';
import { classifyPlaceType } from './domain/placeType.ts';
import { haversineMeters } from './domain/geo.ts';
import type { Candidate, Station } from './domain/types.ts';

const PLACES_BASE = 'https://places.googleapis.com/v1';
const DISCOVERY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_RADIUS_M = 500;
const NEARBY_MAX_RESULTS = 20;
const GOOGLE_TIMEOUT_MS = 5_000;

const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY') ?? '';

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
  'googleMapsUri',
  'nationalPhoneNumber',
  'photos',
].join(',');

const PHOTO_MAX_WIDTH = 640;

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
  priceLevel?: string;
  googleMapsUri?: string;
  nationalPhoneNumber?: string;
  photos?: { name?: string }[];
  movedPlaceId?: string;
}

// 구글 types/primaryType → 표시용 한글 업종 라벨(라이브, 저장 안 함).
const TYPE_LABEL_KO: Record<string, string> = {
  korean_restaurant: '한식', japanese_restaurant: '일식', chinese_restaurant: '중식',
  italian_restaurant: '이탈리안', american_restaurant: '양식', french_restaurant: '프렌치',
  asian_restaurant: '아시안', vietnamese_restaurant: '베트남', thai_restaurant: '태국',
  indian_restaurant: '인도', mexican_restaurant: '멕시칸', spanish_restaurant: '스페인',
  seafood_restaurant: '해산물', sushi_restaurant: '스시', ramen_restaurant: '라멘',
  barbecue_restaurant: '고기·구이', steak_house: '스테이크', pizza_restaurant: '피자',
  hamburger_restaurant: '햄버거', fast_food_restaurant: '패스트푸드',
  brunch_restaurant: '브런치', breakfast_restaurant: '브런치',
  cafe: '카페', coffee_shop: '카페', bakery: '베이커리', dessert_shop: '디저트',
  bar: '술집', pub: '펍', wine_bar: '와인바', night_club: '클럽', brewery: '브루어리',
  bar_and_grill: '술·식사', meal_takeaway: '음식점', restaurant: '음식점',
};

function koreanCategory(primaryType: string | null, types: string[]): string | null {
  if (primaryType && TYPE_LABEL_KO[primaryType]) return TYPE_LABEL_KO[primaryType];
  for (const t of types) if (TYPE_LABEL_KO[t]) return TYPE_LABEL_KO[t];
  return null;
}

// 사진 리소스 이름(photos[].name) → 표시용 CDN URL(라이브, 저장 안 함).
// skipHttpRedirect=true 면 키 없이 바로 로드 가능한 photoUri(JSON)를 반환. 실패 시 null.
async function fetchPhotoUri(photoName: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${PLACES_BASE}/${photoName}/media?maxWidthPx=${PHOTO_MAX_WIDTH}&skipHttpRedirect=true`,
      {
        headers: { 'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY },
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { photoUri?: string };
    return data.photoUri ?? null;
  } catch {
    return null;
  }
}

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
    name: p.displayName?.text ?? null,
    distanceM: loc ? haversineMeters(station.lat, station.lng, loc.latitude, loc.longitude) : null,
    placeTypeOverride: null,
    categoryKorean: null,
    openDate: null,
  };
}

async function nearbySearch(
  station: Station,
  radiusM: number,
  includedTypes: string[] = [],
): Promise<GooglePlace[]> {
  const res = await fetch(`${PLACES_BASE}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': NEARBY_FIELD_MASK,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // 채택된 음식 카테고리의 구글 type으로 검색을 좁힌다. 없으면 전체 음식점.
      includedPrimaryTypes: includedTypes.length > 0 ? includedTypes : ['restaurant'],
      maxResultCount: NEARBY_MAX_RESULTS,
      rankPreference: 'POPULARITY',
      languageCode: 'ko',
      regionCode: 'KR',
      locationRestriction: {
        circle: {
          center: { latitude: station.lat, longitude: station.lng },
          radius: radiusM,
        },
      },
    }),
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });
  const data = await res.json() as { places?: GooglePlace[] };
  return data.places ?? [];
}

export async function ensureStation(stationId: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase
    .from('station_places')
    .upsert(
      { station_id: stationId, station_lat: lat, station_lng: lng },
      { onConflict: 'station_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function discoverAndFetch(
  station: Station,
  radiusM: number = DEFAULT_RADIUS_M,
  recordDiscovery = true,
  includedTypes: string[] = [],
): Promise<Candidate[]> {
  const places = await nearbySearch(station, radiusM, includedTypes);

  const live = places
    .filter((p) => p.businessStatus !== 'CLOSED_PERMANENTLY')
    .map((p) => ({ ...p, id: p.movedPlaceId ?? p.id }));

  if (live.length > 0) {
    const rows = live.map((p) => ({
      source: 'google' as const,
      google_place_id: p.id,
      station_id: station.id,
      place_type: classifyPlaceType(p.types ?? [], p.primaryType ?? null),
    }));
    const { error: upErr } = await supabase
      .from('places')
      .upsert(rows, { onConflict: 'google_place_id' });
    if (upErr) throw upErr;
  }

  if (recordDiscovery) {
    const { error: metaErr } = await supabase
      .from('station_places')
      .update({ places_discovered_at: new Date().toISOString(), place_count: live.length })
      .eq('station_id', station.id);
    if (metaErr) throw metaErr;
  }

  const ids = live.map((p) => p.id);
  const { data: placeRows } = await supabase
    .from('places')
    .select('id, google_place_id')
    .in('google_place_id', ids);
  const idByGoogle = new Map((placeRows ?? []).map((r) => [r.google_place_id, r.id]));

  return live.map((p) => toCandidate(p, station, idByGoogle.get(p.id) ?? null));
}

export async function isDiscoveryStale(stationId: string): Promise<boolean> {
  const { data } = await supabase
    .from('station_places')
    .select('places_discovered_at')
    .eq('station_id', stationId)
    .single();
  if (!data?.places_discovered_at) return true;
  return Date.now() - new Date(data.places_discovered_at).getTime() > DISCOVERY_TTL_MS;
}

export interface PlaceDisplay {
  ref: string;
  name: string | null;
  category: string | null; // 라이브 구글 업종 한글 라벨(저장 안 함)
  imageUrl: string | null; // 라이브 구글 사진 CDN URL(저장 안 함)
  types: string[];
  primaryType: string | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: number | null;
  address: string | null;
  phone: string | null;
  mapUrl: string | null;
  lat: number | null;
  lng: number | null;
}

// Edge Function은 stateless — in-memory 캐시 없이 매번 라이브 조회.
// 최종 후보(3~4건)만 호출하므로 과금 영향 미미.
export async function placeDetails(googlePlaceIds: string[]): Promise<Map<string, PlaceDisplay>> {
  const out = new Map<string, PlaceDisplay>();
  await Promise.all(
    googlePlaceIds.map(async (id) => {
      try {
        const res = await fetch(`${PLACES_BASE}/places/${id}?languageCode=ko&regionCode=KR`, {
          headers: {
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': DETAILS_FIELD_MASK,
          },
          signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
        });
        const p = await res.json() as GooglePlace;
        const photoName = p.photos?.[0]?.name;
        const imageUrl = photoName ? await fetchPhotoUri(photoName) : null;
        out.set(id, {
          ref: id,
          name: p.displayName?.text ?? null,
          category: koreanCategory(p.primaryType ?? null, p.types ?? []),
          imageUrl,
          types: p.types ?? [],
          primaryType: p.primaryType ?? null,
          rating: p.rating ?? null,
          userRatingCount: p.userRatingCount ?? null,
          priceLevel: mapPriceLevel(p.priceLevel),
          address: p.formattedAddress ?? null,
          phone: p.nationalPhoneNumber ?? null,
          mapUrl: p.googleMapsUri ?? null,
          lat: p.location?.latitude ?? null,
          lng: p.location?.longitude ?? null,
        });
      } catch {
        // 개별 실패는 무시 — 스냅샷 폴백으로 표시
      }
    }),
  );
  return out;
}
