// 추천 결과 더미 식당 데이터.
// CLAUDE.md 3.5: 운영에선 구글 Places API(New) Nearby Search 라이브 결과를 쓴다.
// 여기 데이터는 백엔드 연동 전 화면 동작 확인용 목업 — id(place_id), name, category,
// rating, userRatingCount, imageUrl 만 채워 카드 컴포넌트가 그대로 받을 수 있게 한다.
import type { Restaurant } from "../types";

import restaurantImg1 from "../assets/restaurant-1.png";
import restaurantImg2 from "../assets/restaurant-2.png";
import restaurantImg3 from "../assets/restaurant-3.png";

export const DUMMY_RESTAURANTS: Restaurant[] = [
  {
    id: "ChIJ-dummy-1",
    name: "데일리픽스",
    category: "햄버거",
    rating: 4.8,
    userRatingCount: 616,
    imageUrl: restaurantImg1,
  },
  {
    id: "ChIJ-dummy-2",
    name: "신복면관",
    category: "중국 음식점",
    rating: 4.5,
    userRatingCount: 387,
    imageUrl: restaurantImg2,
  },
  {
    id: "ChIJ-dummy-3",
    name: "강남고기집",
    category: "한식·고기",
    rating: 4.6,
    userRatingCount: 248,
    imageUrl: restaurantImg3,
  },
  {
    id: "ChIJ-dummy-4",
    name: "이자카야 노다지",
    category: "일식·이자카야",
    rating: 4.3,
    userRatingCount: 122,
    imageUrl: restaurantImg1,
  },
];
