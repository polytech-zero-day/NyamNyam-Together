import { useEffect } from "react";
import { colors } from "@toss/tds-colors";
import { Asset, Text } from "@toss/tds-mobile";
import loaderPrimary from "../assets/loader-primary.svg";

// F-10 추천 로딩 화면. 추천 엔진(필터→정렬→압축)이 끝나면 정렬 기준 선택(F-16)으로 보낸다.
// 데모는 setTimeout 으로 자동 진행. 탭(onClick) 으로도 즉시 넘어갈 수 있음.
// 라우팅 미연결 — useApp().goto 호출은 다음 단계에서 추가.
const AUTO_ADVANCE_MS = 2000;

interface Props {
  // 라우팅 연결 시점에 goto("sort-select") 같은 핸들러를 주입.
  // 없으면 자동 진행/탭 시 그냥 console.log 만 찍힘(데모용).
  onComplete?: () => void;
}

export function LoadingScreen({ onComplete }: Props) {
  useEffect(() => {
    const t = setTimeout(() => {
      if (onComplete) onComplete();
      else console.log("[loading] 추천 완료 — onComplete 미연결");
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
        gap: 24,
        background: "#fff",
        cursor: onComplete ? "pointer" : "default",
      }}
    >
      <Asset.Image
        src={loaderPrimary}
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
        식당을 찾았어요
      </Text>
      <Text
        typography="t5"
        color={colors.grey500}
        style={{ textAlign: "center" }}
      >
        잠시만 기다려주세요
      </Text>
    </div>
  );
}
