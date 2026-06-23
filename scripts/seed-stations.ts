// 역 좌표 정적 적재 (station_places). ⚠️ 구글 등 외부 API 호출 0.
// 역 위경도는 공개·불변 정적 데이터 → DB에 미리 박아두면 끝. 프론트는 stationId(역명)만 보내면
// 서버가 좌표를 조회한다(routes/sessions.ts). place_id 워밍(구글)은 seed-places.ts로 별도.
//
// 데이터 소스:
//   - scripts/data/stations.json 이 있으면 그 전체를 적재(수도권 전 역 등 — 용량 무시 가능).
//     형식: [{ "id": "강남역", "lat": 37.4979, "lng": 127.0276 }, ...]  (id 대신 name 도 허용)
//     출처 예: 서울 열린데이터광장/공공데이터포털 '지하철역 좌표' CSV→JSON 변환.
//   - 파일이 없으면 내장 데모 목록(주요 5역)만 적재.
//
// 실행:  npm run seed:stations
// 필요 env(.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { supabase } from '../src/config/supabase';
import type { Station } from '../src/domain/types';

// 데이터 파일 없을 때의 내장 데모 목록(주요 5역). station_id = 역명.
const DEMO_STATIONS: Station[] = [
  { id: '강남역', lat: 37.497942, lng: 127.027621 },
  { id: '홍대입구역', lat: 37.557527, lng: 126.924191 },
  { id: '건대입구역', lat: 37.540372, lng: 127.069276 },
  { id: '신림역', lat: 37.484201, lng: 126.929715 },
  { id: '철산역', lat: 37.476895, lng: 126.866944 },
];

interface RawStation {
  id?: string;
  name?: string;
  lat: number;
  lng: number;
}

// 데이터 파일 로드 + 정규화 + 역명 중복 제거(환승역 등은 1개 좌표만).
function loadStations(): { stations: Station[]; source: string } {
  const file = path.join(__dirname, 'data', 'stations.json');
  if (!fs.existsSync(file)) {
    return { stations: DEMO_STATIONS, source: '내장 데모(5역) — scripts/data/stations.json 없음' };
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as RawStation[];
  const byId = new Map<string, Station>();
  for (const r of raw) {
    const id = (r.id ?? r.name ?? '').trim();
    if (!id || typeof r.lat !== 'number' || typeof r.lng !== 'number') continue;
    if (!byId.has(id)) byId.set(id, { id, lat: r.lat, lng: r.lng }); // 역명 중복 시 첫 좌표 채택
  }
  return { stations: [...byId.values()], source: `scripts/data/stations.json (${byId.size}역)` };
}

async function main(): Promise<void> {
  const { stations, source } = loadStations();
  console.log(`역 좌표 적재(구글 호출 없음) — 소스: ${source}`);
  // 배치 upsert(청크 500) — 581 순차 왕복 대신 1~2회로 단축
  const rows = stations.map((s) => ({ station_id: s.id, station_lat: s.lat, station_lng: s.lng }));
  const CHUNK = 500;
  let ok = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('station_places')
      .upsert(chunk, { onConflict: 'station_id', ignoreDuplicates: true });
    if (error) console.error(`  ✗ 청크 ${i}~${i + chunk.length}:`, error.message);
    else ok += chunk.length;
  }
  console.log(`✅ ${ok}/${stations.length}역 적재 완료`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('역 좌표 적재 실패:', err);
    process.exit(1);
  });
