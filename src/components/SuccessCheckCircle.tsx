import { colors } from "@toss/tds-colors";

// 완료 화면 공용: 파란 원 + 흰색 체크. 외부 이미지 의존 없이 인라인 SVG로 그려 깨지지 않는다.
// (InviteGeneratedScreen의 SuccessCircle과 동일한 방식, 색만 @toss/tds-colors 토큰 사용)
export function SuccessCheckCircle({ size = 96 }: { size?: number }) {
  const check = Math.round(size / 2);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: colors.blue500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-hidden
    >
      <svg width={check} height={check} viewBox="0 0 48 48" fill="none">
        <path
          d="M12 24l8 8 16-18"
          stroke={colors.white}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
