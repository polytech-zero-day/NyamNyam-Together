// 최종 투표 결과 더미 데이터.
// CLAUDE.md 4. 핵심 사용자 플로우: "전원 👍 투표 → 최다 득표 자연 부상".
// 1위는 카드로 크게, 2/3위는 작게 노출. 식당 정보는 기존 dummy-restaurants 의 더미 사용.
// 백엔드 연동 시 이 export 구조를 그대로 API 응답으로 교체하면 화면 코드는 무수정.
import type { Restaurant } from "../types";
import { DUMMY_RESTAURANTS } from "./dummy-restaurants";

export interface VoteResult {
  restaurant: Restaurant;
  voteCount: number;
  rank: number;
}

export const DUMMY_VOTE_RESULTS: VoteResult[] = [
  { restaurant: DUMMY_RESTAURANTS[0], voteCount: 2, rank: 1 },
  { restaurant: DUMMY_RESTAURANTS[1], voteCount: 1, rank: 2 },
  { restaurant: DUMMY_RESTAURANTS[2], voteCount: 0, rank: 3 },
];
