import { useState } from "react";
import { colors } from "@toss/tds-colors";
import { BottomCTA, ListHeader, Top } from "@toss/tds-mobile";
import { SORT_OPTIONS, type SortOrder } from "../types";

// F-16 정렬 기준 선택 (세션 공유, 1회 선택).
// 후보 노출 직전 1차 투표 후 표시 — 리뷰순(기본)/평점순/랜덤 중 단일 선택.
// 기본값은 "리뷰순" (CLAUDE.md 3.6: 표본 얇은 한국 식당 보정).
interface Props {
  onConfirm?: (sort: SortOrder) => void;
}

export function SortSelectScreen({ onConfirm }: Props) {
  const [selected, setSelected] = useState<SortOrder>("reviews");

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
      <Top
        title={
          <Top.TitleParagraph size={22}>
            어떤 식당을 추천 받을까요?
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={17}>
            추천 기준을 골라주세요
          </Top.SubtitleParagraph>
        }
      />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {SORT_OPTIONS.map(({ id, label, subText }) => {
          const isSelected = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              style={{
                // 시안 옵션 카드: 선택 시 짙은 회색, 미선택은 연한 회색.
                background: isSelected ? colors.grey200 : colors.grey50,
                border: "none",
                outline: "none",
                borderRadius: 12,
                padding: "12px 20px",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <ListHeader
                title={
                  <ListHeader.TitleParagraph typography="t4" fontWeight="bold">
                    {label}
                  </ListHeader.TitleParagraph>
                }
                description={
                  <ListHeader.DescriptionParagraph>
                    {subText}
                  </ListHeader.DescriptionParagraph>
                }
                descriptionPosition="bottom"
              />
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: "auto" }}>
        {/* 기본값(reviews)이 미리 선택되어 있어 항상 활성. CLAUDE.md 3.6 "미선택 시 기본값=리뷰순". */}
        <BottomCTA.Single
          onClick={() => {
            if (onConfirm) onConfirm(selected);
            else console.log("[sort-select] selected:", selected);
          }}
        >
          추천받기
        </BottomCTA.Single>
      </div>
    </div>
  );
}
