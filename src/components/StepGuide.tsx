import { colors } from "@toss/tds-colors";

// OnboardingScreen / ParticipantOnboardingScreen 공용 3단계 안내 컴포넌트.
// (기존 OnboardingScreen에 인라인으로 있던 StepRow/Connector를 추출해 재사용)

export function StepRow({ num, text }: { num: number; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: colors.grey100,
          color: colors.grey600,
          fontSize: 13,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {num}
      </div>
      <span style={{ fontSize: 16, color: colors.grey800, fontWeight: 500 }}>
        {text}
      </span>
    </div>
  );
}

export function Connector() {
  return (
    <div
      style={{
        marginLeft: 13,
        width: 1,
        height: 18,
        background: colors.grey200,
      }}
    />
  );
}
