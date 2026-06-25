// 스토리/테스트 공용 목 데이터. 백엔드 server/index.ts 응답 형태와 일치.
import type {
  RecommendationsResponse,
  SessionResponse,
  StationRegionDTO,
  StationsResponse,
} from "../../api/dto";

// 실백엔드 GET /stations(권역 큐레이션 맵)와 동일한 7개 권역. 좌표는 목 표시용(역명만 노출).
function mockRegion(
  id: string,
  name: string,
  names: string[],
  baseLat: number,
  baseLng: number,
): StationRegionDTO {
  return {
    id,
    name,
    stations: names.map((n, i) => ({ id: n, lat: baseLat + i * 0.003, lng: baseLng + i * 0.003 })),
  };
}

export const stationsFixture: StationsResponse = {
  regions: [
    mockRegion("gangnam", "강남·서초·송파", ["강남역", "신논현역", "양재역", "교대역", "서초역", "잠실역", "삼성역", "선릉역", "가락시장역"], 37.497, 127.027),
    mockRegion("yongsan", "용산·마포·서대문", ["용산역", "이태원역", "홍대입구역", "합정역", "공덕역", "신촌역"], 37.53, 126.96),
    mockRegion("jongno", "종로·동대문", ["종로3가역", "광화문역", "동대문역", "동대문역사문화공원역", "혜화역"], 37.571, 126.99),
    mockRegion("seongsu", "성수·건대입구", ["성수역", "건대입구역", "뚝섬역", "왕십리역"], 37.544, 127.056),
    mockRegion("gwanak", "관악·영등포", ["서울대입구역", "신림역", "영등포역", "여의도역", "당산역"], 37.481, 126.952),
    mockRegion("incheon", "인천", ["인천역", "동인천역", "부평역", "주안역", "송도역", "인천터미널역"], 37.476, 126.617),
    mockRegion("gwangmyeong", "광명", ["광명사거리역", "철산역", "광명역"], 37.478, 126.864),
  ],
};

export const sessionFixture: SessionResponse = {
  id: "sess_demo_1",
  host_user_key: 1001,
  station_id: "강남역",
  title: "금요일 저녁 모임",
  min_participants: 3,
  purpose: "친구들과의 모임",
  deadline: "2026-06-25T19:00:00.000Z",
  status: "voting",
  sort_mode: "review_count",
  sort_seed: 1,
  winner_recommendation_id: null,
  created_at: "2026-06-24T10:00:00.000Z",
  participantCount: 4,
};

export const recommendationsFixture: RecommendationsResponse = {
  sortMode: "review_count",
  relaxed: false,
  attribution: "Powered by Google",
  leader: { recId: "rec_2", voteCount: 2 },
  recommendations: [
    {
      recId: "rec_1",
      placeId: "ChIJ_demo_1",
      rank: 1,
      placeType: "general",
      relaxed: false,
      source: "google",
      name: "데일리픽스",
      category: "햄버거",
      imageUrl: null,
      rating: 4.8,
      reviewCount: 616,
      priceLevel: 2,
      distanceM: 180,
      address: "서울 강남구 ...",
      phone: null,
      mapUrl: "https://maps.google.com/?cid=1",
      voteCount: 1,
      poweredByGoogle: true,
    },
    {
      recId: "rec_2",
      placeId: "ChIJ_demo_2",
      rank: 2,
      placeType: "compatible",
      relaxed: false,
      source: "google",
      name: "강남고기집",
      category: "고기·구이",
      imageUrl: null,
      rating: 4.6,
      reviewCount: 248,
      priceLevel: 3,
      distanceM: 320,
      address: "서울 강남구 ...",
      phone: null,
      mapUrl: "https://maps.google.com/?cid=2",
      voteCount: 2,
      poweredByGoogle: true,
    },
    {
      recId: "rec_3",
      placeId: "ChIJ_demo_3",
      rank: 3,
      placeType: "general",
      relaxed: false,
      source: "google",
      name: "신복면관",
      category: "중식",
      imageUrl: null,
      rating: 4.5,
      reviewCount: 387,
      priceLevel: 1,
      distanceM: 450,
      address: "서울 강남구 ...",
      phone: null,
      mapUrl: "https://maps.google.com/?cid=3",
      voteCount: 0,
      poweredByGoogle: true,
    },
  ],
};
