import { useEffect } from "react";
import { colors } from "@toss/tds-colors";
import { Asset, Text } from "@toss/tds-mobile";
import checkFillIcon from "../assets/check-fill-circle.svg";

// F-14 2차(후보) 투표 후 대기 화면.
// 참여자가 후보 식당 중 하나를 골라 투표한 직후 — 다른 참여자들이 끝나길 기다리는 상태.
// 시안에 하단 CTA 없음 (참여자는 액션 없이 대기). 나가려면 네비게이션 바 < 또는 X.
// 백엔드 연동 시 전원 완료 신호 받으면 자동으로 VoteCountingScreen 으로 전환.
// 데모는 setTimeout + 화면 탭으로 즉시 진행 가능.
const AUTO_ADVANCE_MS = 2500;

interface Props {
  votedCount?: number;
  totalCount?: number;
  onComplete?: () => void;
}

export function SecondVoteWaitingScreen({
  votedCount = 1,
  totalCount = 3,
  onComplete,
}: Props) {
  useEffect(() => {
    const t = setTimeout(() => {
      if (onComplete) onComplete();
      else console.log("[second-vote-waiting] onComplete 미연결");
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div
      onClick={onComplete}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        gap: 16,
        background: "#fff",
        cursor: onComplete ? "pointer" : "default",
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
        style={{ textAlign: "center" }}
      >
        투표를 완료했어요
      </Text>
      <Text
        typography="t5"
        color={colors.grey500}
        style={{ textAlign: "center" }}
      >
        {`투표 진행 중 ( ${votedCount} / ${totalCount} )`}
      </Text>
    </div>
  );
}
