import { useState } from "react";
import { colors } from "@toss/tds-colors";
import { Asset, BottomSheet, List, ListRow } from "@toss/tds-mobile";
import { useApp } from "../store";
import { ALCOHOL_OPTIONS, type Alcohol } from "../types";
import { getPortalRoot } from "../lib/portal";
import { SheetDoubleCTA } from "../components/SheetDoubleCTA";

// F-05 술자리 선택 (3지선다, 단일선택).
// id ("drink"/"around"/"uncomfortable") 는 추천엔진의 술→장소타입 매핑(CLAUDE.md 3.2) 에 그대로 쓰임.
interface Props {
  onClose: () => void;
}

export function AlcoholSelectSheet({ onClose }: Props) {
  const { participant, patchParticipant } = useApp();
  const [selected, setSelected] = useState<Alcohol | null>(
    participant.alcohol ?? null,
  );

  function handleNext() {
    if (selected == null) return;
    patchParticipant({ alcohol: selected });
    onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      portalContainer={getPortalRoot()}
      header={<BottomSheet.Header>술자리</BottomSheet.Header>}
      cta={
        <SheetDoubleCTA
          onClose={onClose}
          onNext={handleNext}
          nextDisabled={selected == null}
        />
      }
    >
      <List>
        {ALCOHOL_OPTIONS.map(({ id, label }) => (
          <ListRow
            key={id}
            contents={<ListRow.Texts type="1RowTypeA" top={label} />}
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
