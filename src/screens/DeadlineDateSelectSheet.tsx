import { useState } from "react";
import { colors } from "@toss/tds-colors";
import { Asset, BottomSheet, List, ListRow, Text } from "@toss/tds-mobile";
import { useApp } from "../store";
import { getPortalRoot } from "../lib/portal";
import { SheetDoubleCTA } from "../components/SheetDoubleCTA";

// F-02 마감 날짜 선택 바텀시트.
// 시안 21:3775(모임 9)은 임시로 역 리스트가 박혀 있어 무시 — 년/월/일 선택으로 구현.
// TDS Mobile엔 휠/캘린더 피커 컴포넌트가 없어, OS 네이티브 date picker를 띄우는
// input[type="date"] + 빠른 프리셋 ListRow 조합으로 처리한다.
// deadline 포맷: "YYYY-MM-DD HH:MM" (시간 부분은 DeadlineTimeSelectSheet에서 채움)

const PRESETS = [
  { label: "오늘", daysFromToday: 0 },
  { label: "내일", daysFromToday: 1 },
  { label: "모레", daysFromToday: 2 },
  { label: "일주일 뒤", daysFromToday: 7 },
] as const;

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatKorean(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map((n) => Number(n));
  return `${y}년 ${m}월 ${d}일`;
}

interface Props {
  onClose: () => void;
  onNext: () => void;
}

export function DeadlineDateSelectSheet({ onClose, onNext }: Props) {
  const { patchMeeting, meeting } = useApp();
  const today = todayIso();
  const initialDate = meeting.deadline?.split(" ")[0] ?? today;
  const [date, setDate] = useState<string>(initialDate);

  function handleNext() {
    // 시간 부분이 이미 저장되어 있으면 보존. 없으면 날짜만.
    const existingTime = meeting.deadline?.split(" ")[1] ?? "";
    const next = existingTime ? `${date} ${existingTime}` : date;
    patchMeeting({ deadline: next });
    onNext();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      portalContainer={getPortalRoot()}
      header={<BottomSheet.Header>언제까지 투표할까요?</BottomSheet.Header>}
      headerDescription={
        <BottomSheet.HeaderDescription>
          마감 날짜를 골라주세요.
        </BottomSheet.HeaderDescription>
      }
      cta={<SheetDoubleCTA onClose={onClose} onNext={handleNext} />}
    >
      <div style={{ padding: "8px 24px 16px" }}>
        <Text
          typography="t5"
          fontWeight="semibold"
          color={colors.grey800}
          style={{ margin: "0 0 8px" }}
        >
          {formatKorean(date)}
        </Text>
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          style={{
            width: "100%",
            padding: "14px 16px",
            fontSize: 17,
            border: "none",
            background: colors.grey100,
            borderRadius: 12,
            color: colors.grey800,
            fontFamily: "inherit",
          }}
        />
      </div>
      <List>
        {PRESETS.map(({ label, daysFromToday }) => {
          const presetDate = addDays(today, daysFromToday);
          return (
            <ListRow
              key={label}
              contents={<ListRow.Texts type="1RowTypeA" top={label} />}
              right={
                date === presetDate ? (
                  <Asset.Icon
                    name="icon-check-mono"
                    color={colors.blue500}
                    frameShape={{ width: 24, height: 24 }}
                    backgroundColor="transparent"
                  />
                ) : undefined
              }
              onClick={() => setDate(presetDate)}
            />
          );
        })}
      </List>
    </BottomSheet>
  );
}
