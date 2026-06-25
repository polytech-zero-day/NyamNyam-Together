import { describe, expect, it } from "vitest";
import {
  ALCOHOL_TO_DRINK,
  SORT_TO_BACKEND,
  backendToSort,
  moodToBackend,
  toRecommendationCards,
  toVoteResults,
} from "./adapters";
import { recommendationsFixture } from "../test/msw/fixtures";

describe("enum 매핑", () => {
  it("술 수용도 → 백엔드 drink", () => {
    expect(ALCOHOL_TO_DRINK.drink).toBe("drinker");
    expect(ALCOHOL_TO_DRINK.around).toBe("ok");
    expect(ALCOHOL_TO_DRINK.uncomfortable).toBe("uncomfortable");
  });

  it("정렬 모드 라운드트립", () => {
    expect(SORT_TO_BACKEND.reviews).toBe("review_count");
    expect(backendToSort("review_count")).toBe("reviews");
    expect(backendToSort("rating")).toBe("rating");
    expect(backendToSort("random")).toBe("random");
  });

  it("분위기 → quiet/any (MVP 가중치 0)", () => {
    expect(moodToBackend(undefined)).toBeUndefined();
    expect(moodToBackend("분위기 있는")).toBe("quiet");
    expect(moodToBackend("도란도란 대화")).toBe("quiet");
    expect(moodToBackend("왁자지껄한")).toBe("any");
  });
});

describe("추천 응답 변환", () => {
  it("카드: id=recId, placeId 보존, 리뷰수=userRatingCount", () => {
    const cards = toRecommendationCards(recommendationsFixture.recommendations);
    expect(cards).toHaveLength(3);
    expect(cards[0].id).toBe("rec_1");
    expect(cards[0].placeId).toBe("ChIJ_demo_1");
    expect(cards[0].userRatingCount).toBe(616);
    expect(cards[0].imageUrl).toBeTruthy();
  });

  it("VoteResult: 득표수 내림차순으로 rank 부여", () => {
    const results = toVoteResults(recommendationsFixture.recommendations);
    expect(results[0].restaurant.name).toBe("강남고기집"); // 2표
    expect(results[0].rank).toBe(1);
    expect(results[0].voteCount).toBe(2);
    expect(results[2].voteCount).toBe(0);
  });
});
