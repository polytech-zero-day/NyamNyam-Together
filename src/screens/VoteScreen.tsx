import { useMemo, useState } from "react";
import { colors } from "@toss/tds-colors";
import { Asset, BottomCTA, Text, Top } from "@toss/tds-mobile";
import { SORT_OPTIONS, type Restaurant, type SortOrder } from "../types";
import { DUMMY_RESTAURANTS } from "../data/dummy-restaurants";
import { BRAND_ORANGE } from "../components/icons";

// F-12 후보 투표 화면(시안 36~38). SortSelectScreen 에서 고른 정렬 기준으로 추천된 3~4 곳을 보여준다.
// 한 화면 + sort prop 만 다른 시안 3개를 이 컴포넌트로 처리 — 부제(정렬 라벨)와 카드 순서가 바뀐다.
// 카드 탭 → 외곽선 진해짐(선택). 선택 후 "투표하기".
// AI 추천 이유는 표시하지 않음(F-15 폐기). 평점·리뷰수만.
// 식당 데이터는 props — 백엔드 연동 전 기본값은 DUMMY_RESTAURANTS.
interface Props {
  sort: SortOrder;
  restaurants?: Restaurant[];
  onVote?: (restaurantId: string) => void;
}

// 목업 정렬: 선택 기준에 따라 순서만 다르게.
//   · reviews → 리뷰수(userRatingCount) 내림차순
//   · rating  → 평점(rating) 내림차순
//   · random  → id 해시 기반 고정 셔플(새로고침해도 순서 불변 — CLAUDE.md 3.6)
// 실제 정렬/압축은 추천엔진(백엔드)이 수행한다. 여기는 화면 확인용.
function sortRestaurants(list: Restaurant[], sort: SortOrder): Restaurant[] {
  const copy = [...list];
  if (sort === "rating") {
    return copy.sort((a, b) => b.rating - a.rating);
  }
  if (sort === "random") {
    const hash = (s: string) =>
      [...s].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
    return copy.sort((a, b) => hash(a.id) - hash(b.id));
  }
  // 기본: 리뷰순
  return copy.sort((a, b) => b.userRatingCount - a.userRatingCount);
}

export function VoteScreen({
  sort,
  restaurants = DUMMY_RESTAURANTS,
  onVote,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sortLabel =
    SORT_OPTIONS.find((o) => o.id === sort)?.label ?? "리뷰 많은 순";
  const sorted = useMemo(
    () => sortRestaurants(restaurants, sort),
    [restaurants, sort],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        // 후보 카드가 길어 화면을 넘기므로 화면을 뷰포트 높이로 고정하고
        // 카드 영역만 내부 스크롤시킨다(하단 CTA 는 항상 보이게). #root transform 때문에
        // position:fixed 가 뷰포트가 아닌 #root 에 붙어 BottomCTA fixed 는 여기선 안 맞음.
        height: "calc(100vh - var(--navbar-height))",
        minHeight: 0,
        overflow: "hidden",
        background: colors.white,
      }}
    >
      <Top
        title={
          <Top.TitleParagraph size={22}>
            마음에 드는 곳에 투표해요
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={17}>{sortLabel}</Top.SubtitleParagraph>
        }
      />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          alignItems: "center",
        }}
      >
        {sorted.map((r) => (
          <RestaurantCard
            key={r.id}
            restaurant={r}
            selected={selectedId === r.id}
            onClick={() => setSelectedId(r.id)}
          />
        ))}
      </div>

      {/* 시안 단일 CTA. 바깥 컨테이너를 뷰포트 높이로 고정해 카드 영역만 스크롤되므로
          여기는 일반(비-fixed) BottomCTA 로 충분하다.
          BottomCTA.Single 은 CTAButtonProps 를 상속하므로 disabled 를 주면
          미선택 시 TDS 가 자동으로 비활성(연한 주황) 스타일을 적용한다(CreateMeeting 저장과 동일). */}
      <BottomCTA.Single
        disabled={selectedId == null}
        onClick={() => {
          if (selectedId == null) return;
          if (onVote) onVote(selectedId);
          else console.log("[vote] voted:", selectedId);
        }}
      >
        투표하기
      </BottomCTA.Single>
    </div>
  );
}

// 식당 카드: 320×200 이미지 + 하단 흰 정보행. 선택 시 외곽선 진하게 + inset shadow.
function RestaurantCard({
  restaurant,
  selected,
  onClick,
}: {
  restaurant: Restaurant;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 320,
        height: 200,
        borderRadius: 20,
        // 시안: 선택 4px 진한 주황 + inset shadow / 미선택 0.7px 연한 주황
        border: selected
          ? `4px solid ${BRAND_ORANGE}`
          : `0.7px solid ${BRAND_ORANGE}`,
        boxShadow: selected ? "inset 6px 6px 4px 0 rgba(0,0,0,0.25)" : "none",
        background: colors.white,
        padding: 0,
        overflow: "hidden",
        position: "relative",
        cursor: "pointer",
      }}
    >
      {/* imageUrl: 백엔드가 구글 라이브 사진 URL을 주면 그대로, 없으면 adapters 에서 placeholder 폴백. */}
      <Asset.Image
        src={restaurant.imageUrl}
        frameShape={{ width: 320, height: 200, radius: 20 }}
        scaleType="crop"
        alt={restaurant.name}
        backgroundColor="transparent"
      />
      {/* 하단 정보 행 — 카드 위에 absolute 로 깔린다. */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: colors.white,
          padding: "8px 20px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            flex: 1,
            textAlign: "left",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Text
            typography="t5"
            fontWeight="semibold"
            color={colors.grey800}
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {restaurant.name}
          </Text>
          <Text typography="t7" color={colors.grey500}>
            {restaurant.category}
          </Text>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <Asset.Icon
            name="icon-star-mono"
            color={colors.yellow600}
            frameShape={{ width: 20, height: 20 }}
            backgroundColor="transparent"
          />
          <Text typography="t6" fontWeight="semibold" color={colors.grey800}>
            {`${restaurant.rating.toFixed(1)}(${restaurant.userRatingCount})`}
          </Text>
        </div>
      </div>
    </button>
  );
}
