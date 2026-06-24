// 주요 역 place_id 워밍 스크립트 (google-places-api.md "사전 배치")
// ⚠️ 서비스 코드 아님. 배포 대상 아님. 콘텐츠 창고가 아니라 "place_id 워밍"이다.
//
// 동작: 각 주요 역에 대해 Nearby Search(라이브) → places에 place_id만 upsert(콘텐츠 미저장).
//       ToS상 영구 저장 가능한 건 place_id뿐. 이름·평점 등은 집계/표시 시점 라이브 조회.
//
// 실행:  npm run seed
// 필요 env(.env): GOOGLE_PLACES_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import 'dotenv/config';
import { ensureStation, discoverAndFetch } from '../src/services/googlePlaces';
import type { Station } from '../src/domain/types';

// google-places-api.md 데모용 역 목록. 좌표는 역 중심부 근사값.
const STATIONS: Station[] = [
  { id: '강남역', lat: 37.497942, lng: 127.027621 },
  { id: '홍대입구역', lat: 37.557527, lng: 126.924191 },
  { id: '건대입구역', lat: 37.540372, lng: 127.069276 },
  { id: '신림역', lat: 37.484201, lng: 126.929715 },
  { id: '철산역', lat: 37.476895, lng: 126.866944 },
];

async function seedStation(s: Station): Promise<void> {
  console.log(`\n=== ${s.id} place_id 워밍 ===`);
  await ensureStation(s.id, s.lat, s.lng); // station_places 메타 등록
  const candidates = await discoverAndFetch(s); // Nearby 라이브 → place_id upsert
  console.log(`  place_id 적재: ${candidates.length}개 (콘텐츠 미저장)`);
}

async function main(): Promise<void> {
  console.log(`워밍 대상 역: ${STATIONS.map((s) => s.id).join(', ')}`);
  for (const s of STATIONS) {
    try {
      await seedStation(s);
    } catch (err) {
      console.error(`❌ ${s.id} 실패 — 다음 역으로 계속:`, err);
    }
  }
  console.log('\n✅ 전체 place_id 워밍 완료');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('워밍 중단:', err);
    process.exit(1);
  });
