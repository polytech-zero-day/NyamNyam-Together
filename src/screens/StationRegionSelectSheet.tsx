import { useState } from "react";
import { colors } from "@toss/tds-colors";
import { Asset, BottomSheet, List, ListRow, Text } from "@toss/tds-mobile";
import { useApp } from "../store";
import { useStations } from "../api";
import { getPortalRoot } from "../lib/portal";
import { SheetDoubleCTA } from "../components/SheetDoubleCTA";

interface Props {
  onClose: () => void;
  onNext: () => void;
}

// F-02 위치 선택 - 1단: 권역 선택 바텀시트.
// 권역/역 목록은 백엔드 GET /stations(useStations)에서 받아온다(station_places 시드 기준).
// "다음" → store에 regionId 저장 후 onNext()로 역 선택 시트를 연다.
export function StationRegionSelectSheet({ onClose, onNext }: Props) {
  const { patchMeeting, meeting } = useApp();
  const { data, isLoading, isError } = useStations();
  const regions = data?.regions ?? [];
  const [selected, setSelected] = useState<string | null>(meeting.regionId ?? null);

  function handleNext() {
    if (selected == null) return;
    // 권역이 바뀌면 기존 역 선택은 무효 → 초기화.
    const stationReset =
      selected !== meeting.regionId
        ? { station: undefined, stationLat: undefined, stationLng: undefined }
        : {};
    patchMeeting({ regionId: selected, ...stationReset });
    onNext();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      portalContainer={getPortalRoot()}
      header={
        <BottomSheet.Header>어느 지역의 맛집을 추천할까요?</BottomSheet.Header>
      }
      headerDescription={
        <BottomSheet.HeaderDescription>
          지역을 고르면 역을 선택할 수 있어요.
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
      {isLoading ? (
        <div style={{ padding: "16px 24px 24px" }}>
          <Text typography="t6" color={colors.grey600}>
            지역 목록을 불러오고 있어요…
          </Text>
        </div>
      ) : isError || regions.length === 0 ? (
        <div style={{ padding: "16px 24px 24px" }}>
          <Text typography="t6" color={colors.grey600}>
            지역 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
          </Text>
        </div>
      ) : (
        <List>
          {regions.map(({ id, name }) => (
            <ListRow
              key={id}
              contents={<ListRow.Texts type="1RowTypeA" top={name} />}
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
      )}
    </BottomSheet>
  );
}
