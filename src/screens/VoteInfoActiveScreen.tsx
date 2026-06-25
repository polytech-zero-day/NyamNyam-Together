import { colors } from "@toss/tds-colors";
import {
  Asset,
  Badge,
  BottomCTA,
  Border,
  CTAButton,
  ListHeader,
} from "@toss/tds-mobile";
import { useEffect, useState } from "react";
import { useApp } from "../store";
import { useCloseSession, useProgress, useSession } from "../api";
import { compactDeadline } from "../lib/format";
import womanIcon from "../assets/woman-fill-circle.svg";

// F-13 투표 정보(진행중). 모임의 모든 설정값과 현재 투표 진행 상황을 한 화면에 표시.
// 투표 인원은 GET /progress 폴링, 남은 시간은 session.deadline 카운트다운, 강제종료는 POST /close.
// (호스트 이름은 백엔드에 없어 placeholder 유지)
const HOST_NAME = "김토스";

// deadline(ISO) → 남은 시간 "HH:MM:SS". 없으면 "--:--:--", 지났으면 00:00:00.
function formatRemaining(deadlineIso: string | null | undefined, nowMs: number): string {
  if (!deadlineIso) return "--:--:--";
  const end = new Date(deadlineIso).getTime();
  if (isNaN(end)) return "--:--:--";
  let s = Math.max(0, Math.floor((end - nowMs) / 1000));
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

export function VoteInfoActiveScreen() {
  const { meeting, back, goto, sessionId } = useApp();
  const progress = useProgress(sessionId, { enabled: sessionId != null });
  const session = useSession(sessionId);
  const close = useCloseSession(sessionId ?? "");

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const TIME_LEFT = formatRemaining(session.data?.deadline, nowMs);

  const respondedCount = progress.data?.responded ?? 0;
  // '최소 인원'은 모임 설정값(min_participants)을 표시한다 — 현재 참여 인원과 별개.
  const minMembers = session.data?.min_participants ?? meeting.minMembers ?? 3;
  // '투표 인원'의 분모는 목표 인원(현재 참여 인원과 최소 인원 중 큰 값).
  const totalMembers = Math.max(progress.data?.total ?? 0, minMembers);

  async function handleForceClose() {
    if (close.isPending) return;
    try {
      await close.mutateAsync();
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
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "24px 0 8px",
          }}
        >
          <Asset.Image
            src={womanIcon}
            frameShape={{ width: 100, height: 100 }}
            scaleType="fit"
            alt=""
            backgroundColor="transparent"
          />
        </div>

        <ListHeader
          title={
            <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
              생성자
            </ListHeader.TitleParagraph>
          }
          right={
            <ListHeader.RightText typography="t6">
              {HOST_NAME}
            </ListHeader.RightText>
          }
        />
        <ListHeader
          title={
            <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
              모임 목적
            </ListHeader.TitleParagraph>
          }
          right={
            <ListHeader.RightText typography="t6">
              {meeting.purpose ?? "친구들과의 모임"}
            </ListHeader.RightText>
          }
        />
        <ListHeader
          title={
            <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
              최소 인원
            </ListHeader.TitleParagraph>
          }
          right={
            <ListHeader.RightText typography="t6">
              {`${minMembers}명`}
            </ListHeader.RightText>
          }
        />
        <ListHeader
          title={
            <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
              위치(역)
            </ListHeader.TitleParagraph>
          }
          right={
            <ListHeader.RightText typography="t6">
              {meeting.station ?? "강남역"}
            </ListHeader.RightText>
          }
        />
        <ListHeader
          title={
            <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
              마감 시간
            </ListHeader.TitleParagraph>
          }
          right={
            <ListHeader.RightText typography="t6">
              {compactDeadline(meeting.deadline)}
            </ListHeader.RightText>
          }
        />

        <Border variant="height16" />

        <ListHeader
          title={
            <div
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <ListHeader.TitleParagraph typography="t4" fontWeight="bold">
                투표 정보
              </ListHeader.TitleParagraph>
              <Badge variant="fill" color="yellow" size="small">
                투표중
              </Badge>
            </div>
          }
        />
        <ListHeader
          title={
            <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
              투표 인원
            </ListHeader.TitleParagraph>
          }
          right={
            <ListHeader.RightText typography="t6">
              {`${respondedCount}/${totalMembers} 명`}
            </ListHeader.RightText>
          }
        />
        <ListHeader
          title={
            <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
              남은 시간
            </ListHeader.TitleParagraph>
          }
          right={
            <ListHeader.RightText typography="t6">
              {TIME_LEFT}
            </ListHeader.RightText>
          }
        />

        <Border variant="height16" />

        <ListHeader
          title={
            <ListHeader.TitleParagraph typography="t4" fontWeight="bold">
              식당 정보
            </ListHeader.TitleParagraph>
          }
        />
        <ListHeader
          title={
            <ListHeader.TitleParagraph
              typography="t5"
              fontWeight="bold"
              color={colors.grey500}
            >
              식당 이름
            </ListHeader.TitleParagraph>
          }
          right={
            <ListHeader.RightText typography="t6" color={colors.grey400}>
              없음
            </ListHeader.RightText>
          }
        />
        <ListHeader
          title={
            <ListHeader.TitleParagraph
              typography="t5"
              fontWeight="bold"
              color={colors.grey500}
            >
              식당 주소
            </ListHeader.TitleParagraph>
          }
          right={
            <ListHeader.RightText typography="t6" color={colors.grey400}>
              없음
            </ListHeader.RightText>
          }
        />
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
          <CTAButton color="primary" onClick={back}>
            닫기
          </CTAButton>
        }
      />
    </div>
  );
}
