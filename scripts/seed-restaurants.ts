// 주요 역 사전 배치 스크립트 (kakao-api.md "사전 배치" / 2단계 데이터 구축)
// ⚠️ 서비스 코드 아님. 배포 대상 아님. 배포 전 로컬에서 1회 실행한다.
//
// 동작: 각 주요 역에 대해
//   1단계) 카카오 FD6 accuracy 상위 45개 → restaurants 적재
//   2단계) 클로드 웹서치(다이닝코드·식신)로 가격·분위기·평점 보완 (force)
//
// 실행:  npm run seed
// 필요 env(.env): KAKAO_REST_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

import 'dotenv/config';
import {
  ensureStationExists,
  getOrFetchRestaurants,
  enrichStationRestaurants,
} from '../src/services/kakao';

interface SeedStation {
  id: string; // station_id (캐시 키) — 역 이름 그대로 사용
  lat: number;
  lng: number;
}

// kakao-api.md 데모용 역 목록. 좌표는 역 중심부 근사값.
const STATIONS: SeedStation[] = [
  { id: '강남역', lat: 37.497942, lng: 127.027621 },
  { id: '홍대입구역', lat: 37.557527, lng: 126.924191 },
  { id: '건대입구역', lat: 37.540372, lng: 127.069276 },
  { id: '신림역', lat: 37.484201, lng: 126.929715 },
  { id: '철산역', lat: 37.476895, lng: 126.866944 },
];

async function seedStation(s: SeedStation): Promise<void> {
  console.log(`\n=== ${s.id} 사전 배치 시작 ===`);

  // 역 좌표 등록 (station_restaurants 메타 INSERT)
  await ensureStationExists(s.id, s.lat, s.lng);

  // 1단계: 카카오 적재 (최초이므로 TTL 만료 상태 → 실제 호출)
  const places = await getOrFetchRestaurants(s.id);
  console.log(`  [1단계] 카카오 적재: ${places.length}개`);

  // 2단계: 클로드 웹서치 보완 (사전 배치는 force로 항상 최신화)
  console.log(`  [2단계] 웹서치 보완 중… (식당 수에 따라 수 분 소요될 수 있음)`);
  await enrichStationRestaurants(s.id, { force: true });
  console.log(`  [2단계] 웹서치 보완 완료`);
}

async function main(): Promise<void> {
  console.log(`사전 배치 대상 역: ${STATIONS.map((s) => s.id).join(', ')}`);
  for (const s of STATIONS) {
    try {
      await seedStation(s);
    } catch (err) {
      console.error(`❌ ${s.id} 실패 — 다음 역으로 계속:`, err);
    }
  }
  console.log('\n✅ 전체 사전 배치 완료');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('사전 배치 중단:', err);
    process.exit(1);
  });
