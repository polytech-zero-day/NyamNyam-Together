import { colors } from "@toss/tds-colors";
import { Asset, BottomCTA, CTAButton, Text } from "@toss/tds-mobile";
import { useApp } from "../store";
import { useCloseSession, useProgress } from "../api";
import checkFillIcon from "../assets/check-fill-circle.svg";

// F-13/F-14 투표 대기 화면. 호스트가 "투표 현황보기"로 진입했을 때 보는 진행 상황.
// 좌측 "투표 강제종료" → host가 마감 시간 전에 강제 종료(F-09, POST /close → 집계 트리거).
// 우측 "자세히보기" → 14번 상세. 진행률(N/M)은 GET /progress 폴링.
export function VoteWaitingScreen() {
  const { goto, sessionId } = useApp();
  const progress = useProgress(sessionId, { enabled: sessionId != null });
  const close = useCloseSession(sessionId ?? "");
  const respondedCount = progress.data?.responded ?? 0;
  const totalCount = progress.data?.total ?? 0;

  async function handleForceClose() {
    if (close.isPending) return;
    try {
      await close.mutateAsync(); // collecting → aggregating(추천 작성)
    } catch (err) {
      console.error("투표 종료 실패:", err);
    }
    goto("vote-info-closed");
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        background: "#fff",
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "80px 24px 24px",
        }}
      >
        <Asset.Image
          src={checkFillIcon}
          frameShape={{ width: 100, height: 100 }}
          scaleType="fit"
          alt=""
          backgroundColor="transparent"
        />
        <Text
          typography="t3"
          fontWeight="bold"
          color={colors.grey800}
          style={{ margin: "24px 0 8px", textAlign: "center" }}
        >
          아직 투표가 완료되지 않았어요
        </Text>
        <Text
          typography="t5"
          color={colors.grey500}
          style={{ textAlign: "center" }}
        >
          {`투표 진행 중 ( ${respondedCount} / ${totalCount} )`}
        </Text>
      </div>

      <BottomCTA.Double
        leftButton={
          <CTAButton
            color="dark"
            variant="weak"
            disabled={close.isPending}
            onClick={handleForceClose}
          >
            투표 강제종료
          </CTAButton>
        }
        rightButton={
          <CTAButton color="primary" onClick={() => goto("vote")}>
            자세히보기
          </CTAButton>
        }
      />
    </div>
  );
}
