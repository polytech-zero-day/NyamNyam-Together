import { useState } from "react";
import { colors } from "@toss/tds-colors";
import { BottomCTA, CTAButton, ProgressBar, Text, Top } from "@toss/tds-mobile";
import { useApp } from "../store";
import { FOOD_CATEGORIES, type FoodCategory } from "../types";

// F-07 음식 취향 선택 (별도 전체 화면, 시트 아님).
// 8개 카테고리 2×4 그리드 — 최대 3개까지 중복 선택.
// "저장" → store.participant.foods 갱신 + back() 으로 PreferenceFormScreen 복귀.
// MVP: 2표 이상 받은 카테고리만 추천에 사용되는 룰(CLAUDE.md 기능정의서 정정 사항)은 백엔드 집계.
//      이 화면은 참여자 한 명의 선호만 받음.
const MAX_SELECT = 3;

// 시안에 디테일한 음식 아이콘이 깔려있긴 한데 placeholder 성격이라 호스트 폼 패턴(이모지) 일관성 유지.
const FOOD_EMOJI: Record<FoodCategory, string> = {
  한식: "🍚",
  일식: "🍣",
  양식: "🍝",
  중식: "🥟",
  분식: "🌭",
  아시안: "🍜",
  "고기·구이": "🥩",
  "카페·브런치": "☕️",
};

export function FoodSelectScreen() {
  const { participant, patchParticipant, back } = useApp();
  const [selected, setSelected] = useState<Set<FoodCategory>>(
    () => new Set(participant.foods),
  );

  // 진행률은 PreferenceFormScreen 과 동일 — 음식 화면도 폼의 일부.
  const filledCount = [
    participant.alcohol,
    participant.budgetLabel,
    selected.size > 0 ? "x" : null,
    participant.mood,
  ].filter((v) => v != null).length;
  const progress = filledCount / 4;

  function toggle(cat: FoodCategory) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else if (next.size < MAX_SELECT) {
        next.add(cat);
      }
      // 3개 꽉 차고 새 항목 누르면 무시 (or 별도 안내). MVP 데모는 조용히 무시.
      return next;
    });
  }

  function handleSave() {
    if (selected.size === 0) return;
    patchParticipant({ foods: Array.from(selected) });
    back();
  }

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
      <div style={{ padding: "5px 10px" }}>
        <ProgressBar progress={progress} size="light" />
      </div>

      <Top
        title={
          <Top.TitleParagraph size={22}>
            어떤 메뉴를 좋아하나요?
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={17}>
            3개까지 고를 수 있어요
          </Top.SubtitleParagraph>
        }
      />

      {/* 2×4 그리드. TDS 에 selectable grid 가 없어서 button 그리드 + TDS 토큰. */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          alignContent: "start",
        }}
      >
        {FOOD_CATEGORIES.map((cat) => {
          const isSelected = selected.has(cat);
          const isCapReached = !isSelected && selected.size >= MAX_SELECT;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggle(cat)}
              disabled={isCapReached}
              style={{
                // 선택: 더 짙은 회색 / 미선택: 연한 회색 (시안 토큰 매칭).
                background: isSelected
                  ? colors.greyOpacity200
                  : colors.greyOpacity50,
                border: "none",
                outline: "none",
                borderRadius: 9,
                padding: "12px 8px",
                height: 74,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                cursor: isCapReached ? "not-allowed" : "pointer",
                opacity: isCapReached ? 0.4 : 1,
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1 }}>
                {FOOD_EMOJI[cat]}
              </span>
              <Text typography="t6" fontWeight="medium" color={colors.grey800}>
                {cat}
              </Text>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: "auto" }}>
        <BottomCTA.Double
          leftButton={
            <CTAButton color="dark" variant="weak" onClick={back}>
              이전
            </CTAButton>
          }
          rightButton={
            <CTAButton
              color="primary"
              disabled={selected.size === 0}
              onClick={handleSave}
            >
              저장
            </CTAButton>
          }
        />
      </div>
    </div>
  );
}
