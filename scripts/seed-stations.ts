// 주요 역 좌표 정적 적재 (station_places). ⚠️ 구글 등 외부 API 호출 0.
// 역 위경도는 공개·불변 정적 데이터 → DB에 미리 박아두면 끝. 프론트는 stationId(역명)만 보내면
// 서버가 좌표를 조회한다(routes/sessions.ts). place_id 워밍(구글)은 seed-places.ts로 별도.
//
// 실행:  npm run seed:stations
// 필요 env(.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import 'dotenv/config';
import { ensureStation } from '../src/services/googlePlaces';
import type { Station } from '../src/domain/types';

// 데모용 서울 주요 역. station_id = 역명(표시·식별 겸용). 좌표는 역 중심부 근사값.
const STATIONS: Station[] = [
  { id: '강남역', lat: 37.497942, lng: 127.027621 },
  { id: '홍대입구역', lat: 37.557527, lng: 126.924191 },
  { id: '건대입구역', lat: 37.540372, lng: 127.069276 },
  { id: '신림역', lat: 37.484201, lng: 126.929715 },
  { id: '철산역', lat: 37.476895, lng: 126.866944 },
];

async function main(): Promise<void> {
  console.log(`주요 역 좌표 적재(구글 호출 없음): ${STATIONS.map((s) => s.id).join(', ')}`);
  for (const s of STATIONS) {
    await ensureStation(s.id, s.lat, s.lng);
    console.log(`  ✓ ${s.id} (${s.lat}, ${s.lng})`);
  }
  console.log('✅ 역 좌표 적재 완료');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('역 좌표 적재 실패:', err);
    process.exit(1);
  });
