// 카카오 로컬 API 호출 + 역 단위 TTL 캐싱 (kakao-api.md)
// sort=accuracy: 카카오 자체 인기도 알고리즘 상위 45개 수집.
// restaurants 테이블에 정규화 저장 (payload jsonb 방식 폐기).

import axios from 'axios';
import { supabase } from '../config/supabase';
import type { RestaurantRow } from '../domain/pipeline';
import { enrichRestaurantsWithWebSearch } from './claude';

const KAKAO_BASE = 'https://dapi.kakao.com/v2/local';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일
const SEARCH_RADIUS = 500;
const MAX_PAGES = 3; // 3 × 15 = 45개

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
if (!KAKAO_REST_API_KEY) throw new Error('KAKAO_REST_API_KEY must be set');

const kakaoClient = axios.create({
  baseURL: KAKAO_BASE,
  headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
});

interface KakaoDocument {
  id: string;
  place_name: string;
  category_name: string;
  distance: string;
  x: string;         // 경도
  y: string;         // 위도
  place_url: string;
  address_name: string;
  road_address_name: string;
  phone: string;
}

function parseCategoryParts(categoryName: string) {
  const parts = categoryName.split(' > ').map((s) => s.trim());
  return {
    category_large: parts[0] ?? categoryName,
    category_mid: parts[1] ?? null,
    category_small: parts[2] ?? null,
  };
}

// 카카오 FD6(음식점) 카테고리 검색 — sort=accuracy, 3페이지 × 15개
async function fetchPlacesFromKakao(lat: number, lng: number): Promise<KakaoDocument[]> {
  const docs: KakaoDocument[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await kakaoClient.get('/search/category.json', {
      params: {
        category_group_code: 'FD6',
        x: lng,   // 카카오: x = 경도
        y: lat,   // 카카오: y = 위도
        radius: SEARCH_RADIUS,
        sort: 'accuracy',
        page,
        size: 15,
      },
    });
    docs.push(...(res.data.documents as KakaoDocument[]));
    if (res.data.meta.is_end) break;
  }
  return docs;
}

// 카카오 응답을 restaurants 테이블에 upsert (카카오 컬럼만 갱신, 웹서치 컬럼 보존)
async function upsertKakaoRestaurants(
  stationId: string,
  docs: KakaoDocument[],
): Promise<void> {
  if (docs.length === 0) return;

  const rows = docs.map((d) => {
    const { category_large, category_mid, category_small } = parseCategoryParts(d.category_name);
    return {
      kakao_id: d.id,
      station_id: stationId,
      name: d.place_name,
      category_large,
      category_mid,
      category_small,
      category_name: d.category_name,
      address: d.address_name || null,
      road_address: d.road_address_name || null,
      phone: d.phone || null,
      lat: parseFloat(d.y),
      lng: parseFloat(d.x),
      distance_m: d.distance ? parseInt(d.distance, 10) : null,
      kakao_url: d.place_url || null,
    };
  });

  const { error } = await supabase.from('restaurants').upsert(rows, {
    onConflict: 'kakao_id',
    // 웹서치 컬럼(price_level, avg_price_min/max, mood, source, source_rating 등)은 갱신하지 않음
    ignoreDuplicates: false,
  });
  if (error) throw error;
}

/**
 * Lazy TTL 캐싱: station_id를 캐시 키로 사용.
 * kakao_fetched_at 없거나 30일 초과 → 카카오 호출 후 restaurants upsert.
 * 항상 DB에서 restaurants 반환.
 *
 * station_restaurants 레코드는 sessions 생성 시 미리 upsert되어 있어야 함.
 */
export async function getOrFetchRestaurants(stationId: string): Promise<RestaurantRow[]> {
  const { data: meta, error: metaError } = await supabase
    .from('station_restaurants')
    .select('station_lat, station_lng, kakao_fetched_at')
    .eq('station_id', stationId)
    .single();

  if (metaError || !meta) throw new Error(`station_restaurants not found: ${stationId}`);

  const isExpired =
    !meta.kakao_fetched_at ||
    Date.now() - new Date(meta.kakao_fetched_at).getTime() > TTL_MS;

  if (isExpired) {
    const docs = await fetchPlacesFromKakao(
      Number(meta.station_lat),
      Number(meta.station_lng),
    );
    await upsertKakaoRestaurants(stationId, docs);
    await supabase.from('station_restaurants').update({
      kakao_fetched_at: new Date().toISOString(),
      restaurant_count: docs.length,
    }).eq('station_id', stationId);
  }

  const { data: rows, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('station_id', stationId)
    .order('source_rating', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (rows ?? []) as RestaurantRow[];
}

/**
 * 2단계 웹서치 보완 (kakao-api.md 캐싱 전략 2단계).
 * web_enriched_at TTL(30일) 만료/null이면 클로드 웹서치로 restaurants의
 * price_level·avg_price·mood·source_rating 컬럼을 보완하고 web_enriched_at 갱신.
 *
 * - force=true: TTL 무시하고 강제 보완 (사전 배치 스크립트에서 사용).
 * - 카카오 컬럼은 건드리지 않음 (웹서치 컬럼만 update).
 * - 확인 안 된 값은 null로 저장 (db-schema.md 저장 원칙).
 *
 * 실시간 세션 경로에서는 비동기 백그라운드로 호출 (CLAUDE.md §6) — 응답을 차단하지 않음.
 */
export async function enrichStationRestaurants(
  stationId: string,
  opts: { force?: boolean } = {},
): Promise<void> {
  const { data: meta } = await supabase
    .from('station_restaurants')
    .select('web_enriched_at')
    .eq('station_id', stationId)
    .single();

  const isFresh =
    meta?.web_enriched_at &&
    Date.now() - new Date(meta.web_enriched_at).getTime() < TTL_MS;
  if (!opts.force && isFresh) return; // 보완 캐시 신선 → 스킵

  const { data: rows, error } = await supabase
    .from('restaurants')
    .select('kakao_id, name, category_name, address')
    .eq('station_id', stationId);
  if (error) throw error;
  if (!rows || rows.length === 0) return;

  const enrichments = await enrichRestaurantsWithWebSearch(
    rows.map((r) => ({
      kakao_id: r.kakao_id,
      name: r.name,
      category_name: r.category_name,
      address: r.address,
    })),
  );

  const now = new Date().toISOString();
  for (const e of enrichments) {
    const { error: upErr } = await supabase
      .from('restaurants')
      .update({
        price_level: e.price_level,
        avg_price_min: e.avg_price_min,
        avg_price_max: e.avg_price_max,
        mood: e.mood,
        source: e.source,
        source_rating: e.source_rating,
        source_url: e.source_url,
        crawled_at: now,
      })
      .eq('kakao_id', e.kakao_id);
    if (upErr) throw upErr;
  }

  await supabase
    .from('station_restaurants')
    .update({ web_enriched_at: now })
    .eq('station_id', stationId);
}

/**
 * 역 좌표 등록 (세션 생성 시 호출).
 * station_restaurants가 없으면 INSERT, 있으면 좌표만 갱신하지 않음 (ignoreDuplicates: true).
 */
export async function ensureStationExists(
  stationId: string,
  lat: number,
  lng: number,
): Promise<void> {
  await supabase.from('station_restaurants').upsert(
    { station_id: stationId, station_lat: lat, station_lng: lng },
    { onConflict: 'station_id', ignoreDuplicates: true },
  );
}
