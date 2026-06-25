import { useState } from "react";
import { colors } from "@toss/tds-colors";
import { Asset, BottomSheet, List, ListRow } from "@toss/tds-mobile";
import { useApp } from "../store";
import type { Purpose } from "../types";
import { getPortalRoot } from "../lib/portal";
import { SheetDoubleCTA } from "../components/SheetDoubleCTA";

// F-01 모임 목적 선택 바텀시트. CreateMeetingScreen의 "모임 목적" 행을 누르면 열림.
// 4개 목적 모두 단일선택 가능.
// ⚠️ CLAUDE.md 규칙("MVP는 친구 모임만 완성, 나머지는 준비중/비활성")과는 어긋난다.
//    나머지 목적(연인/부모님/기타)은 전용 질문 세트·추천 로직이 아직 없어서, 선택해도
//    이후 흐름은 친구 모임과 동일하게 진행된다(목적값만 저장될 뿐 분기 없음).
const PURPOSE_OPTIONS: Purpose[] = [
  "친구들과의 모임",
  "연인과의 데이트",
  "부모님과의 식사",
  "기타",
];

interface Props {
  onClose: () => void;
}

export function PurposeSelectSheet({ onClose }: Props) {
  const { patchMeeting, meeting } = useApp();
  // 시안(06)처럼 "친구들과의 모임"을 기본 선택해 둔다(가장 흔한 목적).
  const [selected, setSelected] = useState<Purpose | null>(
    meeting.purpose ?? "친구들과의 모임",
  );

  function handleNext() {
    if (!selected) return;
    patchMeeting({ purpose: selected });
    onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      portalContainer={getPortalRoot()}
      header={<BottomSheet.Header>모임 목적</BottomSheet.Header>}
      cta={
        <SheetDoubleCTA
          onClose={onClose}
          onNext={handleNext}
          nextDisabled={selected == null}
        />
      }
    >
      <List>
        {/* 4개 목적 모두 활성 — 한 항목 고르면 기존 선택이 풀리고 그것만 체크되는 단일선택. */}
        {PURPOSE_OPTIONS.map((id) => (
          <ListRow
            key={id}
            contents={<ListRow.Texts type="1RowTypeA" top={id} />}
            right={
              selected === id ? (
                <Asset.Icon
                  name="icon-check-mono"
                  color={colors.blue500}
                  frameShape={{ width: 24, height: 24 }}
                  backgroundColor="transparent"
                />
              ) : undefined
            }
            onClick={() => setSelected(id)}
          />
        ))}
      </List>
    </BottomSheet>
  );
}
