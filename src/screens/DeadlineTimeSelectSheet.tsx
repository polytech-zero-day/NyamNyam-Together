import { useState } from "react";
import { colors } from "@toss/tds-colors";
import {
  Asset,
  BottomSheet,
  List,
  ListRow,
  SegmentedControl,
} from "@toss/tds-mobile";
import { useApp } from "../store";
import { getPortalRoot } from "../lib/portal";
import { SheetDoubleCTA } from "../components/SheetDoubleCTA";

// F-02 마감 시간 선택 바텀시트.
// 시안 21:3997(모임 10)은 임시로 역 리스트가 박혀 있어 무시 — 오전/오후 + 시(時) 선택으로 구현.
// 결과는 "HH:MM" 24시간 포맷으로 변환해 deadline의 시간 부분을 채운다.

// 표시 순서: 시계 배치대로 12시부터 11시까지.
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

type Meridiem = "am" | "pm";

// "HH:MM" → { meridiem, hour12 }
function parseTime(deadline: string | undefined): {
  meridiem: Meridiem;
  hour: number | null;
} {
  const timePart = deadline?.split(" ")[1] ?? "";
  const match = /^(\d{2}):(\d{2})$/.exec(timePart);
  if (!match) return { meridiem: "pm", hour: null };
  const h24 = Number(match[1]);
  const meridiem: Meridiem = h24 >= 12 ? "pm" : "am";
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { meridiem, hour: hour12 };
}

// 12시간제 → 24시간제 "HH:00"
// 오전 12시 = 자정(00:00), 오후 12시 = 정오(12:00).
function toHHMM(meridiem: Meridiem, hour12: number): string {
  let h24 = hour12 % 12; // 12 → 0
  if (meridiem === "pm") h24 += 12;
  return `${h24.toString().padStart(2, "0")}:00`;
}

interface Props {
  onClose: () => void;
}

export function DeadlineTimeSelectSheet({ onClose }: Props) {
  const { patchMeeting, meeting } = useApp();
  const initial = parseTime(meeting.deadline);
  const [meridiem, setMeridiem] = useState<Meridiem>(initial.meridiem);
  const [hour, setHour] = useState<number | null>(initial.hour);

  function handleNext() {
    if (hour == null) return;
    const time = toHHMM(meridiem, hour);
    // 날짜 부분이 이미 저장되어 있으면 합치고, 없으면 시간만(임시).
    const existingDate = meeting.deadline?.split(" ")[0];
    const hasDate =
      existingDate != null && /^\d{4}-\d{2}-\d{2}$/.test(existingDate);
    const next = hasDate ? `${existingDate} ${time}` : time;
    patchMeeting({ deadline: next });
    onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      portalContainer={getPortalRoot()}
      header={<BottomSheet.Header>몇 시까지 투표할까요?</BottomSheet.Header>}
      headerDescription={
        <BottomSheet.HeaderDescription>
          이 시간이 지나면 투표가 자동으로 마감돼요.
        </BottomSheet.HeaderDescription>
      }
      cta={
        <SheetDoubleCTA
          onClose={onClose}
          onNext={handleNext}
          nextDisabled={hour == null}
        />
      }
    >
      <div style={{ padding: "8px 24px 16px" }}>
        <SegmentedControl
          value={meridiem}
          onChange={(v) => setMeridiem(v as Meridiem)}
        >
          <SegmentedControl.Item value="am">오전</SegmentedControl.Item>
          <SegmentedControl.Item value="pm">오후</SegmentedControl.Item>
        </SegmentedControl>
      </div>
      <List>
        {HOURS_12.map((h) => (
          <ListRow
            key={h}
            contents={<ListRow.Texts type="1RowTypeA" top={`${h}시`} />}
            right={
              hour === h ? (
                <Asset.Icon
                  name="icon-check-mono"
                  color={colors.blue500}
                  frameShape={{ width: 24, height: 24 }}
                  backgroundColor="transparent"
                />
              ) : undefined
            }
            onClick={() => setHour(h)}
          />
        ))}
      </List>
    </BottomSheet>
  );
}
