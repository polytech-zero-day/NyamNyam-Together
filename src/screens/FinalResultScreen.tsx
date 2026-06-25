import { colors } from "@toss/tds-colors";
import { Asset, Button, IconButton, Text, Top } from "@toss/tds-mobile";
import { DUMMY_VOTE_RESULTS, type VoteResult } from "../data/dummy-vote-results";
import { BRAND_ORANGE } from "../components/icons";

// F-13(투표 결과, 시안 41). 최다 득표 식당 1위 부상, 2·3위는 보조 표시.
// CLAUDE.md 4장: "최종 한 곳 선택은 사용자 몫(시스템은 최다 득표 하이라이트만, 확정하지 않음)".
// 그래서 "선정해드렸어요"가 아니라 "여기로 정해졌어요" — 자연 부상 결과 안내.
// 더미 데이터는 src/data/dummy-vote-results.ts. 백엔드 연동 시 그 export 만 교체하면 됨.
// 2/3위 카드 외곽선은 브랜드 연한 톤(orange200)으로.
interface Props {
  results?: VoteResult[];
  onShare?: () => void;
  onShowMap?: (placeId: string) => void;
}

export function FinalResultScreen({
  results = DUMMY_VOTE_RESULTS,
  onShare,
  onShowMap,
}: Props) {
  const first = results.find((r) => r.rank === 1);
  const others = results
    .filter((r) => r.rank !== 1)
    .sort((a, b) => a.rank - b.rank);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        background: colors.white,
      }}
    >
      <div style={{ flex: 1, overflowY: "auto" }}>
        <Top
          title={
            <Top.TitleParagraph size={22}>
              {`이번 모임 장소는\n여기로 정해졌어요`}
            </Top.TitleParagraph>
          }
          subtitleTop={
            <Top.SubtitleParagraph size={13}>투표 완료!</Top.SubtitleParagraph>
          }
        />

        {first && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "8px 0 16px",
            }}
          >
            <WinnerCard result={first} />
          </div>
        )}

        {others.length > 0 && (
          <>
            <div style={{ padding: "16px 24px 8px" }}>
              <Text typography="t7" color={colors.grey500}>
                다른 후보
              </Text>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "0 20px 24px",
              }}
            >
              {others.map((r) => (
                <OtherCandidateRow key={r.restaurant.id} result={r} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 시안: 좌측 지도 아이콘(좁게) + 우측 공유하기(넓게). 비대칭이라 BottomCTA.Double(50:50)로는
          표현 불가 → TDS IconButton + Button 을 직접 배치(safe-area 패딩은 BottomCTA 규칙과 동일). */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding:
            "12px 20px max(var(--toss-safe-area-bottom, 0px), env(safe-area-inset-bottom), 20px)",
          background: colors.white,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            flexShrink: 0,
            borderRadius: 14,
            background: colors.grey100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconButton
            name="icon-pin-location-mono"
            aria-label="지도 보기"
            variant="clear"
            iconSize={24}
            color={colors.grey700}
            bgColor="transparent"
            onClick={() => {
              if (first && onShowMap) onShowMap(first.restaurant.id);
              else console.log("[final-result] 지도 보기 (미연결)");
            }}
          />
        </div>
        {/* 다른 화면 하단 버튼(예: Welcome 토스 로그인)과 동일한 Button + display="block".
            display="full" 은 화면 가장자리에 붙는 풀블리드 변형이라 border-radius 가 0 이 된다 —
            block 은 부모(여기선 flex:1) 너비를 채우면서 기본 라운드(16px)를 유지한다. */}
        <div style={{ flex: 1 }}>
          <Button
            color="primary"
            variant="fill"
            size="xlarge"
            display="block"
            onClick={() => {
              if (onShare) onShare();
              else console.log("[final-result] 공유하기 (미연결)");
            }}
          >
            공유하기
          </Button>
        </div>
      </div>
    </div>
  );
}

// 1위 카드: VoteScreen 의 RestaurantCard 와 비슷한 구조 + "N표" 우측 표시.
function WinnerCard({ result }: { result: VoteResult }) {
  const { restaurant, voteCount } = result;
  return (
    <div
      style={{
        width: 320,
        height: 200,
        borderRadius: 20,
        border: `1px solid ${BRAND_ORANGE}`,
        background: colors.white,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Asset.Image
        src={restaurant.imageUrl}
        frameShape={{ width: 320, height: 200, radius: 20 }}
        scaleType="crop"
        alt={restaurant.name}
        backgroundColor="transparent"
      />
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
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
          <Text typography="t7" color={colors.grey500}>
            {`${voteCount}표`}
          </Text>
        </div>
      </div>
    </div>
  );
}

// 2/3위 카드: 작은 가로 카드. 좌측 순위 배지(겹쳐 올림) + 작은 이미지 + 이름/카테고리 + 평점.
function OtherCandidateRow({ result }: { result: VoteResult }) {
  const { restaurant, voteCount, rank } = result;
  return (
    <div style={{ position: "relative" }}>
      {/* 순위 배지 — 카드 좌상단에 살짝 겹쳐서 */}
      <div
        style={{
          position: "absolute",
          top: -6,
          left: 12,
          zIndex: 1,
          background: colors.grey700,
          width: 20,
          height: 20,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text typography="t7" fontWeight="bold" color={colors.white}>
          {String(rank)}
        </Text>
      </div>
      <div
        style={{
          background: colors.white,
          border: `1.5px solid ${colors.orange200}`,
          borderRadius: 15,
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          minHeight: 70,
        }}
      >
        <Asset.Image
          src={restaurant.imageUrl}
          frameShape={{ width: 36, height: 36, radius: 9 }}
          scaleType="crop"
          alt={restaurant.name}
          backgroundColor="transparent"
        />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Text
            typography="t5"
            fontWeight="bold"
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
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
            flexShrink: 0,
          }}
        >
          <Text typography="t6" color={colors.grey500}>
            {`${restaurant.rating.toFixed(1)}(${restaurant.userRatingCount})`}
          </Text>
          <Text typography="t7" color={colors.grey500}>
            {`${voteCount}표`}
          </Text>
        </div>
      </div>
    </div>
  );
}
