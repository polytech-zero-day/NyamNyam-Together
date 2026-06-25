import { useEffect } from "react";
import { colors } from "@toss/tds-colors";
import { Asset, Text } from "@toss/tds-mobile";
import checkFillIcon from "../assets/check-fill-circle.svg";

// 집결 직전 — 전원이 취향 입력을 마쳤고 추천 엔진이 돌기 직전에 잠깐 보여주는 안내.
// 참여자 액션 없이 자동으로 다음(LoadingScreen) 으로 전환된다.
// 데모는 setTimeout 으로 자동 / 탭으로 즉시 진행 둘 다 지원 (LoadingScreen 과 같은 패턴).
const AUTO_ADVANCE_MS = 1500;

interface Props {
  onComplete?: () => void;
}

export function AllSettledScreen({ onComplete }: Props) {
  useEffect(() => {
    const t = setTimeout(() => {
      if (onComplete) onComplete();
      else console.log("[all-settled] onComplete 미연결");
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
        모두 다 골랐어요
      </Text>
      <Text
        typography="t5"
        color={colors.grey500}
        style={{ textAlign: "center" }}
      >
        이제 딱 맞는 식당을 찾아볼게요
      </Text>
    </div>
  );
}
