import { useState } from "react";
import { colors } from "@toss/tds-colors";
import { Asset, BottomSheet, List, ListRow, Text } from "@toss/tds-mobile";
import { useApp } from "../store";
import { useStations } from "../api";
import { getPortalRoot } from "../lib/portal";
import { SheetDoubleCTA } from "../components/SheetDoubleCTA";

interface Props {
  onClose: () => void;
}

// F-02 위치 선택 - 2단: 역 선택 바텀시트.
// GET /stations(useStations)에서 meeting.regionId 권역의 역 목록을 보여준다.
// 선택 시 역명 + 좌표(lat/lng)를 store에 저장 → 모임 생성(POST /sessions)에 전달.
export function StationSelectSheet({ onClose }: Props) {
  const { patchMeeting, meeting } = useApp();
  const { data } = useStations();
  const region = data?.regions.find((r) => r.id === meeting.regionId);
  const [selected, setSelected] = useState<string | null>(meeting.station ?? null);

  function handleNext() {
    if (selected == null || region == null) return;
    const station = region.stations.find((s) => s.id === selected);
    patchMeeting({
      station: selected,
      stationLat: station?.lat,
      stationLng: station?.lng,
    });
    onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      portalContainer={getPortalRoot()}
      header={<BottomSheet.Header>어느 역에서 모일까요?</BottomSheet.Header>}
      cta={
        <SheetDoubleCTA
          onClose={onClose}
          onNext={handleNext}
          nextDisabled={selected == null}
        />
      }
    >
      {region == null ? (
        <div style={{ padding: "16px 24px 24px" }}>
          <Text typography="t6" color={colors.grey600}>
            먼저 지역을 골라주세요.
          </Text>
        </div>
      ) : (
        <List>
          {region.stations.map((station) => (
            <ListRow
              key={station.id}
              contents={<ListRow.Texts type="1RowTypeA" top={station.id} />}
              right={
                selected === station.id ? (
                  <Asset.Icon
                    name="icon-check-mono"
                    color={colors.blue500}
                    frameShape={{ width: 24, height: 24 }}
                    backgroundColor="transparent"
                  />
                ) : undefined
              }
              onClick={() => setSelected(station.id)}
            />
          ))}
        </List>
      )}
    </BottomSheet>
  );
}
