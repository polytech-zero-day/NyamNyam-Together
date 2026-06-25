import { useState, type ReactNode } from "react";
import { colors } from "@toss/tds-colors";
import {
  Asset,
  BottomCTA,
  CTAButton,
  List,
  ListRow,
  ProgressBar,
  Top,
} from "@toss/tds-mobile";
import { useApp } from "../store";
import { ALCOHOL_OPTIONS, type Alcohol } from "../types";
import {
  ALCOHOL_TO_DRINK,
  foodsToCategories,
  moodToBackend,
  useStage1Vote,
} from "../api";
import { AlcoholSelectSheet } from "./AlcoholSelectSheet";
import { BudgetSelectSheet } from "./BudgetSelectSheet";
import { MoodSelectSheet } from "./MoodSelectSheet";

// F-05~08 참여자 취향 입력 폼. 술자리/예산/음식 취향/분위기 4가지 항목.
// 술자리/예산/분위기 → 해당 바텀시트 overlay (호스트 CreateMeetingScreen 과 같은 패턴).
// 음식 취향만 → 별도 전체 화면(FoodSelectScreen) 으로 전환 (8개 카테고리 그리드라 시트엔 안 들어감).
// figma 시안 2/4/6/9 (빈/술자리/예산까지/음식까지) state 는 모두 이 한 컴포넌트가 store 로 자동 처리.
type OpenSheet = "alcohol" | "budget" | "mood" | null;

const ALCOHOL_LABELS: Record<Alcohol, string> = Object.fromEntries(
  ALCOHOL_OPTIONS.map((o) => [o.id, o.label]),
) as Record<Alcohol, string>;

export function PreferenceFormScreen() {
  const { participant, back, goto, sessionId } = useApp();
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const stage1 = useStage1Vote(sessionId ?? "");

  const filledCount = [
    participant.alcohol,
    participant.budgetLabel,
    participant.foods.length > 0 ? "x" : null,
    participant.mood,
  ].filter((v) => v != null).length;
  const progress = filledCount / 4;
  const isComplete = filledCount === 4;

  const closeSheet = () => setOpenSheet(null);

  // F-05~08 → 1차 투표(제약 응답) 전송 후 대기 화면으로.
  async function handleSubmit() {
    if (!isComplete || stage1.isPending) return;
    if (!sessionId || participant.alcohol == null || participant.budgetMax == null) return;
    try {
      await stage1.mutateAsync({
        drink: ALCOHOL_TO_DRINK[participant.alcohol],
        budgetMin: participant.budgetMin,
        budgetMax: participant.budgetMax,
        categories: foodsToCategories(participant.foods),
        mood: moodToBackend(participant.mood),
      });
      goto("q-done");
    } catch (err) {
      // 실패 시 전역 토스트가 안내. 화면은 q-hub에 머물러 재시도 가능하게 한다.
      console.error("응답 전송 실패:", err);
    }
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
      <div style={{ padding: "5px 10px" }}>
        <ProgressBar progress={progress} size="light" />
      </div>

      <Top
        title={
          <Top.TitleParagraph size={22}>취향을 알려주세요</Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={17}>
            고른 조건으로 갈 만한 식당을 찾아드려요
          </Top.SubtitleParagraph>
        }
      />

      <List>
        <PreferenceFieldRow
          icon="🍺"
          label="술자리"
          value={
            participant.alcohol ? ALCOHOL_LABELS[participant.alcohol] : null
          }
          onClick={() => setOpenSheet("alcohol")}
        />
        <PreferenceFieldRow
          icon="💰"
          label="예산"
          value={participant.budgetLabel ?? null}
          onClick={() => setOpenSheet("budget")}
        />
        <PreferenceFieldRow
          icon="🍚"
          label="음식 취향"
          value={
            participant.foods.length > 0
              ? participant.foods.join(", ")
              : null
          }
          // 음식만 시트가 아니라 화면 전환 (FoodSelectScreen).
          onClick={() => goto("q-food")}
        />
        <PreferenceFieldRow
          icon="🏪"
          label="분위기"
          value={participant.mood ?? null}
          onClick={() => setOpenSheet("mood")}
        />
      </List>

      {/* 시안: 미완료 = 이전 | 저장(비활성), 4개 다 채우면(30) 단일 "투표하기"로 전환. */}
      <div style={{ marginTop: "auto" }}>
        {isComplete ? (
          <BottomCTA.Single onClick={handleSubmit}>투표하기</BottomCTA.Single>
        ) : (
          <BottomCTA.Double
            leftButton={
              <CTAButton color="dark" variant="weak" onClick={back}>
                이전
              </CTAButton>
            }
            rightButton={
              <CTAButton color="primary" disabled>
                저장
              </CTAButton>
            }
          />
        )}
      </div>

      {/* 시트 overlay — 호스트 CreateMeetingScreen 과 동일한 패턴.
          음식은 시트가 아니라 화면 전환이라 여기 없음 (goto("q-food") 에서 처리). */}
      {openSheet === "alcohol" && <AlcoholSelectSheet onClose={closeSheet} />}
      {openSheet === "budget" && <BudgetSelectSheet onClose={closeSheet} />}
      {openSheet === "mood" && <MoodSelectSheet onClose={closeSheet} />}
    </div>
  );
}

function EmojiIcon({ children }: { children: string }) {
  return (
    <div
      style={{
        width: 30,
        height: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

function CheckIcon() {
  return (
    <Asset.Icon
      name="icon-check-mono"
      color={colors.blue500}
      frameShape={{ width: 24, height: 24 }}
      backgroundColor="transparent"
    />
  );
}

function PreferenceFieldRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: string;
  label: string;
  value: string | null;
  onClick: () => void;
}): ReactNode {
  const filled = value != null;
  return (
    <ListRow
      left={<EmojiIcon>{icon}</EmojiIcon>}
      contents={
        filled ? (
          <ListRow.Texts type="2RowTypeB" top={label} bottom={value!} />
        ) : (
          <ListRow.Texts type="1RowTypeB" top={label} />
        )
      }
      right={filled ? <CheckIcon /> : undefined}
      withArrow={!filled}
      onClick={onClick}
    />
  );
}
