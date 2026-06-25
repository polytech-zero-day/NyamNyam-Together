import { colors } from "@toss/tds-colors";
import { Asset, BottomCTA, Text } from "@toss/tds-mobile";
import checkFillIcon from "../assets/check-fill-circle.svg";

// F-14 응답 진행률 화면 — 참여자 본인의 취향은 보냈고, 다른 참여자/호스트의 종료를 기다리는 대기 상태.
// 게이팅: 집계가 끝나(status=voting, 추천 준비 완료) App 라우터가 자동으로 다음 화면으로 넘긴다.
//   · 그 전엔 이 화면에 머물며 votedCount(N/M)만 폴링으로 갱신 — 탭으로 건너뛸 수 없다.
//   · onConfirm 을 넘기면 명시적 진행 버튼을 노출(특수 흐름용). 참여자 대기에선 미사용.
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
        <Text
          typography="t6"
          color={colors.grey400}
          style={{ marginTop: 12, textAlign: "center" }}
        >
          모두 보내면 자동으로 추천을 찾아드려요
        </Text>
      </div>

      {/* 대기 화면에선 진행 버튼을 노출하지 않는다 — 집계 완료 시 라우터가 자동 전환.
          onConfirm 이 명시적으로 전달된 특수 흐름에서만 버튼을 보여준다. */}
      {onConfirm && (
        <BottomCTA.Single onClick={onConfirm}>확인했어요</BottomCTA.Single>
      )}
    </div>
  );
}
