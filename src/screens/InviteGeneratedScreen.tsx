import { colors } from "@toss/tds-colors";
import {
  Asset,
  BottomCTA,
  CTAButton,
  IconButton,
  Text,
  TextField,
  useToast,
} from "@toss/tds-mobile";
import { useApp } from "../store";
import checkFillIcon from "../assets/check-fill-circle.svg";

// F-03 모임 생성 완료. 호스트가 만든 모임의 초대 링크(?groupId=sessionId)를 보여주고 공유하도록 유도.
function buildInviteLink(sessionId: string | null): string {
  if (!sessionId) return "";
  if (typeof window === "undefined") return `?groupId=${sessionId}`;
  return `${window.location.origin}${window.location.pathname}?groupId=${sessionId}`;
}

export function InviteGeneratedScreen() {
  const { goto, back, sessionId } = useApp();
  const { openToast } = useToast();
  const inviteLink = buildInviteLink(sessionId);

  function handleCopy() {
    if (!inviteLink) return;
    // 웹뷰/브라우저 양쪽에서 동작. 복사 성공 시에만 TDS 토스트로 피드백.
    if (typeof navigator === "undefined" || navigator.clipboard == null) {
      // 클립보드 미지원 환경 — 데모 흐름은 막지 않고 토스트만 생략.
      return;
    }
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => {
        openToast("클립보드에 복사됐어요", {
          icon: "icon-check",
          iconType: "circle",
        });
      })
      .catch(() => {
        // 사용자가 거부했거나 실패 — 토스트 생략(데모 흐름 유지).
      });
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
          padding: "40px 0 24px",
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
          style={{ margin: "24px 0 8px" }}
        >
          모임을 만들었어요
        </Text>
        <Text
          typography="t5"
          color={colors.grey500}
          style={{ textAlign: "center", padding: "0 24px" }}
        >
          초대 링크를 친구들에게 공유해보세요
        </Text>

        <div style={{ width: "100%", marginTop: 40 }}>
          <TextField
            variant="box"
            label="초대 링크"
            labelOption="sustain"
            value={inviteLink}
            onChange={() => {
              // 읽기 전용 — 사용자가 직접 수정하지 않음
            }}
            right={
              <IconButton
                name="icon-copy-mono"
                aria-label="초대 링크 복사"
                variant="clear"
                iconSize={20}
                onClick={handleCopy}
              />
            }
          />
        </div>
      </div>

      <BottomCTA.Double
        leftButton={
          <CTAButton color="dark" variant="weak" onClick={back}>
            닫기
          </CTAButton>
        }
        rightButton={
          <CTAButton color="primary" onClick={() => goto("wait-others")}>
            투표 현황보기
          </CTAButton>
        }
      />
    </div>
  );
}
