import { colors } from "@toss/tds-colors";
import { Asset, BottomCTA, Text } from "@toss/tds-mobile";
import checkFillIcon from "../assets/check-fill-circle.svg";

// F-14 응답 진행률 화면 — 참여자 본인의 취향은 보냈고, 다른 참여자들의 응답을 기다리는 대기 상태.
// "확인했어요"는 앱을 닫지 않고 대기를 유지하는 의도(B안). 백엔드 연동 시:
//   · 전원 완료 신호가 오면 자동으로 AllSettledScreen 으로 전환
//   · 그 전엔 이 화면에 머물면서 votedCount 만 폴링/푸시로 업데이트
// 지금은 백엔드 미연결이라 데모용으로 onConfirm 호출(다음 화면 진행)만 지원.
interface Props {
  votedCount?: number;
  totalCount?: number;
  onConfirm?: () => void;
}

export function VoteSentWaitingScreen({
  votedCount = 1,
  totalCount = 4,
  onConfirm,
}: Props) {
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
          취향을 보냈어요
        </Text>
        <Text
          typography="t5"
          color={colors.grey500}
          style={{ textAlign: "center" }}
        >
          {`투표를 완료한 인원 수 ( ${votedCount} / ${totalCount} )`}
        </Text>
      </div>

      <BottomCTA.Single
        onClick={() => {
          // TODO(backend): 정상 흐름에선 이 버튼 안 누르고도 전원 완료 신호 받으면 자동 전환.
          //   "확인했어요"는 사실상 대기 상태 명시적 확인 — 데모 편의로 다음 화면 진행에 활용.
          if (onConfirm) onConfirm();
          else console.log("[vote-sent-waiting] onConfirm 미연결");
        }}
      >
        확인했어요
      </BottomCTA.Single>
    </div>
  );
}
