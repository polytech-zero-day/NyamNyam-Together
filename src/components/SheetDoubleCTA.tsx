import { BottomSheet, CTAButton } from "@toss/tds-mobile";

// 시트 하단 "닫기 / 다음" 공통 CTA.
//
// BottomSheet.DoubleCTA 는 children 이 아니라 leftButton/rightButton props 로
// ReactNode 를 받는다 (BottomCTA.Double 과 동일 패턴). children 으로 넣으면
// 컴포넌트가 무시하고 두 prop 이 undefined 라 버튼이 아예 안 그려진다.
//
// 시트들이 전부 같은 모양(좌측 회색 닫기 + 우측 주황 다음)이라 한 컴포넌트로
// 묶음. nextLabel 만 시트마다 다를 수 있어 prop 화.
//
// nextDisabled 가 true 면 우측 버튼 비활성 — 시트가 "옵션 미선택" 상태일 때 사용.
interface Props {
  onClose: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  closeLabel?: string;
}

export function SheetDoubleCTA({
  onClose,
  onNext,
  nextDisabled = false,
  nextLabel = "다음",
  closeLabel = "닫기",
}: Props) {
  return (
    <BottomSheet.DoubleCTA
      leftButton={
        <CTAButton color="dark" variant="weak" onClick={onClose}>
          {closeLabel}
        </CTAButton>
      }
      rightButton={
        <CTAButton
          color="primary"
          disabled={nextDisabled}
          onClick={onNext}
        >
          {nextLabel}
        </CTAButton>
      }
    />
  );
}
