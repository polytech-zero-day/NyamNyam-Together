import { useState } from "react";
import { colors } from "@toss/tds-colors";
import { Asset, BottomSheet, List, ListRow } from "@toss/tds-mobile";
import { useApp } from "../store";
import { MOOD_OPTIONS, type Mood } from "../types";
import { getPortalRoot } from "../lib/portal";
import { SheetDoubleCTA } from "../components/SheetDoubleCTA";

// F-08 분위기 선택 (4지선다, 단일선택).
// CLAUDE.md 기준 MVP 가중치 0(추천 점수에 반영 X)이라 데이터는 받아도 추천 결과는 안 바뀜.
// 화면 동작 자체는 정상 — 다른 시트들과 동일 패턴.
interface Props {
  onClose: () => void;
}

export function MoodSelectSheet({ onClose }: Props) {
  const { participant, patchParticipant } = useApp();
  const [selected, setSelected] = useState<Mood | null>(
    participant.mood ?? null,
  );

  function handleNext() {
    if (selected == null) return;
    patchParticipant({ mood: selected });
    onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      portalContainer={getPortalRoot()}
      header={<BottomSheet.Header>분위기</BottomSheet.Header>}
      cta={
        <SheetDoubleCTA
          onClose={onClose}
          onNext={handleNext}
          nextDisabled={selected == null}
        />
      }
    >
      <List>
        {MOOD_OPTIONS.map((mood) => (
          <ListRow
            key={mood}
            contents={<ListRow.Texts type="1RowTypeA" top={mood} />}
            right={
              selected === mood ? (
                <Asset.Icon
                  name="icon-check-mono"
                  color={colors.blue500}
                  frameShape={{ width: 24, height: 24 }}
                  backgroundColor="transparent"
                />
              ) : undefined
            }
            onClick={() => setSelected(mood)}
          />
        ))}
      </List>
    </BottomSheet>
  );
}
