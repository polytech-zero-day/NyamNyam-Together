import { useState } from "react";
import { colors } from "@toss/tds-colors";
import { Asset, BottomSheet, List, ListRow } from "@toss/tds-mobile";
import { useApp } from "../store";
import { getPortalRoot } from "../lib/portal";
import { SheetDoubleCTA } from "../components/SheetDoubleCTA";

// F-02 최소 인원 선택 바텀시트. CreateMeetingScreen의 "최소 인원" 행을 누르면 열림.
// 시안 옵션: 3·4·5·6·7명 + "8명 이상". 8 이상은 8로 저장하고 라벨만 다르게 표시.
const MEMBER_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: "3명" },
  { value: 4, label: "4명" },
  { value: 5, label: "5명" },
  { value: 6, label: "6명" },
  { value: 7, label: "7명" },
  { value: 8, label: "8명 이상" },
];

interface Props {
  onClose: () => void;
}

export function MembersSelectSheet({ onClose }: Props) {
  const { patchMeeting, meeting } = useApp();
  // 연인과의 데이트는 관례상 2명 고정 — 옵션을 2명만 노출.
  const isCouple = meeting.purpose === "연인과의 데이트";
  const options = isCouple ? [{ value: 2, label: "2명" }] : MEMBER_OPTIONS;
  const [selected, setSelected] = useState<number | null>(
    meeting.minMembers ?? (isCouple ? 2 : null),
  );

  function handleNext() {
    if (selected == null) return;
    patchMeeting({ minMembers: selected });
    onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      portalContainer={getPortalRoot()}
      header={<BottomSheet.Header>최소 인원</BottomSheet.Header>}
      headerDescription={
        <BottomSheet.HeaderDescription>
          {isCouple ? "연인 모임은 2명이에요" : "인원은 최소 3명부터 가능해요"}
        </BottomSheet.HeaderDescription>
      }
      cta={
        <SheetDoubleCTA
          onClose={onClose}
          onNext={handleNext}
          nextDisabled={selected == null}
        />
      }
    >
      <List>
        {options.map(({ value, label }) => (
          <ListRow
            key={value}
            contents={<ListRow.Texts type="1RowTypeA" top={label} />}
            right={
              selected === value ? (
                <Asset.Icon
                  name="icon-check-mono"
                  color={colors.blue500}
                  frameShape={{ width: 24, height: 24 }}
                  backgroundColor="transparent"
                />
              ) : undefined
            }
            onClick={() => setSelected(value)}
          />
        ))}
      </List>
    </BottomSheet>
  );
}
