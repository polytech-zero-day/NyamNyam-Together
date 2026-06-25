import { Asset, Badge, BottomCTA, Border, ListHeader } from "@toss/tds-mobile";
import { useApp } from "../store";
import { isNotReady, useRecommendations } from "../api";
import { compactDeadline } from "../lib/format";
import womanIcon from "../assets/woman-fill-circle.svg";

// F-13 투표 정보(종료). 종료 상태값 표시. 식당 정보는 최다 득표 1위(추천 응답)로 채운다.
// (호스트 이름은 백엔드에 없어 placeholder 유지)
const HOST_NAME = "김토스";

export function VoteInfoClosedScreen() {
  const { meeting, back, sessionId } = useApp();
  const recs = useRecommendations(sessionId, undefined, { enabled: sessionId != null });

  const totalMembers = meeting.minMembers ?? 3;

  // 최다 득표 1위(leader 우선, 없으면 voteCount 최댓값)를 식당 정보로.
  const data = recs.data && !isNotReady(recs.data) ? recs.data : null;
  const winner = data
    ? (data.leader
        ? data.recommendations.find((r) => r.recId === data.leader!.recId)
        : [...data.recommendations].sort((a, b) => b.voteCount - a.voteCount)[0]) ?? null
    : null;
  const restaurantName = winner?.name ?? "—";
  const restaurantAddress = winner?.address ?? "—";

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
              {`${totalMembers}명`}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ListHeader.TitleParagraph typography="t4" fontWeight="bold">
                투표 정보
              </ListHeader.TitleParagraph>
              <Badge variant="weak" color="elephant" size="small">
                투표종료
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
              {`${totalMembers}/${totalMembers} 명`}
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
              00:00:00
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
            <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
              식당 이름
            </ListHeader.TitleParagraph>
          }
          right={
            <ListHeader.RightText typography="t6">
              {restaurantName}
            </ListHeader.RightText>
          }
        />
        {/* 주소는 길어서 우측 한 줄에 안 들어감 → 라벨 아래 전체폭으로(줄바꿈 허용). */}
        <ListHeader
          title={
            <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
              식당 주소
            </ListHeader.TitleParagraph>
          }
          description={
            <ListHeader.DescriptionParagraph>
              {restaurantAddress}
            </ListHeader.DescriptionParagraph>
          }
          descriptionPosition="bottom"
        />
      </div>

      <BottomCTA.Single onClick={back}>닫기</BottomCTA.Single>
    </div>
  );
}
