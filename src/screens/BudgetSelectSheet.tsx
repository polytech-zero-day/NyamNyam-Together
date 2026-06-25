import { useState } from "react";
import { colors } from "@toss/tds-colors";
import { Asset, BottomSheet, List, ListRow } from "@toss/tds-mobile";
import { useApp } from "../store";
import { BUDGET_TIERS, type BudgetTierLabel } from "../types";
import { getPortalRoot } from "../lib/portal";
import { SheetDoubleCTA } from "../components/SheetDoubleCTA";

// F-06 예산 선택 — 시안 24 비주얼대로 단일선택(파란 체크).
// 선택한 한 구간의 라벨은 허브 요약/체크에 쓰고, 그 구간의 min~max(원)는 추천엔진 3.3에 전달.
// (시안 부제의 "중복선택 가능해요"는 단일 체크 비주얼과 모순이라 미반영 — 요약 보고서에 명시)
interface Props {
  onClose: () => void;
}

export function BudgetSelectSheet({ onClose }: Props) {
  const { participant, patchParticipant } = useApp();
  const [selected, setSelected] = useState<BudgetTierLabel | null>(
    participant.budgetLabel ?? null,
  );

  function handleNext() {
    if (selected == null) return;
    const tier = BUDGET_TIERS.find((t) => t.label === selected);
    if (tier == null) return;
    patchParticipant({
      budgetLabel: tier.label,
      budgetMin: tier.min,
      budgetMax: tier.max,
    });
    onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      portalContainer={getPortalRoot()}
      header={<BottomSheet.Header>예산</BottomSheet.Header>}
      headerDescription={
        <BottomSheet.HeaderDescription>
          1인당 얼마쯤 생각해요?
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
        {BUDGET_TIERS.map((tier) => (
          <ListRow
            key={tier.label}
            contents={<ListRow.Texts type="1RowTypeA" top={tier.label} />}
            right={
              selected === tier.label ? (
                <Asset.Icon
                  name="icon-check-mono"
                  color={colors.blue500}
                  frameShape={{ width: 24, height: 24 }}
                  backgroundColor="transparent"
                />
              ) : undefined
            }
            onClick={() => setSelected(tier.label)}
          />
        ))}
      </List>
    </BottomSheet>
  );
}
