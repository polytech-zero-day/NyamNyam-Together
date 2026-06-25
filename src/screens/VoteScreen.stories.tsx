import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { VoteScreen } from "./VoteScreen";
import { toRecommendationCards } from "../api/adapters";
import { recommendationsFixture } from "../test/msw/fixtures";

// 추천 응답(fixture)을 카드로 변환해 주입 — 실제 연동 시 useRecommendations 결과와 동일 형태.
const restaurants = toRecommendationCards(recommendationsFixture.recommendations);

const meta = {
  title: "Screens/VoteScreen",
  component: VoteScreen,
  parameters: { layout: "fullscreen" },
  args: { sort: "reviews", restaurants, onVote: fn() },
} satisfies Meta<typeof VoteScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 리뷰순: Story = {};

export const 평점순: Story = {
  args: { sort: "rating" },
};

// play 테스트: 카드 선택 → 투표하기 → onVote 호출 검증(Storybook Interactions 탭에서 실행).
export const 투표동작: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByText("데일리픽스");
    await userEvent.click(card);
    const cta = await canvas.findByRole("button", { name: "투표하기" });
    await userEvent.click(cta);
    await expect(args.onVote).toHaveBeenCalledTimes(1);
  },
};
