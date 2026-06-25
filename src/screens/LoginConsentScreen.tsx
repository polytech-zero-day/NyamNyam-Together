import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { colors } from "@toss/tds-colors";
import {
  Asset,
  BottomSheet,
  Checkbox,
  Text,
  TextButton,
  Top,
} from "@toss/tds-mobile";
import { useApp } from "../store";
import { loginAsHost } from "../api";
import { showToast } from "../lib/toast";
import { getPortalRoot } from "../lib/portal";
import { APP_LOGO_SRC } from "../components/icons";

// F-04 호스트 토스 로그인 동의 화면.
// 약관 텍스트는 코드에 박지 않는다(CLAUDE.md F-04) — 실제 약관은 앱인토스 콘솔 등록값을
// appLogin()이 띄운다. 여기 약관 항목/문구는 동의 UX를 보여주기 위한 데모용 예시다.
// 필수 약관을 모두 체크해야 "동의하고 시작하기"가 활성화된다.
interface Term {
  key: "service" | "privacy";
  label: string;
  body: string;
}
const TERMS: Term[] = [
  {
    key: "service",
    label: "[필수] 서비스 이용약관 동의",
    body: "본 약관은 냠냠투게더 미니앱 이용 조건을 규정합니다. (데모용 예시 약관 — 실제 약관은 앱인토스 콘솔 등록값을 따릅니다.)",
  },
  {
    key: "privacy",
    label: "[필수] 개인정보 수집·이용 동의",
    body: "수집 항목: 토스 사용자 식별값(userKey). 이용 목적: 모임 생성·종료 시 호스트 식별. 보관 기간: 서비스 제공 기간. (데모용 예시)",
  },
];

export function LoginConsentScreen() {
  const { goto, back, setRole } = useApp();
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState<Record<Term["key"], boolean>>({
    service: false,
    privacy: false,
  });
  const [openTerm, setOpenTerm] = useState<Term["key"] | null>(null);

  const allChecked = TERMS.every((t) => agreed[t.key]);

  function toggleAll() {
    const next = !allChecked;
    setAgreed({ service: next, privacy: next });
  }
  function toggleOne(key: Term["key"]) {
    setAgreed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleLogin() {
    if (loading || !allChecked) return;
    setLoading(true);
    try {
      // 토스 앱: appLogin() → /auth/login. 그 외(PC/dev): dev-login 우회(api/auth.ts).
      await loginAsHost();
      setRole("host");
      goto("create-meeting");
    } catch (err) {
      // appLogin·dev-login 모두 실패 — 안내 후 화면에 머문다.
      console.error("토스 로그인 실패:", err);
      showToast("로그인에 실패했어요. 잠시 후 다시 시도해주세요.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* 시트 뒤 배경 콘텐츠 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          background: "#fff",
        }}
      >
        <div style={{ padding: "24px 28px 0" }}>
          {/* 상단 네비와 동일한 앱 로고. 이 화면에선 큰 원형으로 — radius=지름/2 로 원 처리. */}
          <Asset.Image
            src={APP_LOGO_SRC}
            frameShape={{ width: 60, height: 60, radius: 30 }}
            scaleType="fit"
            alt="냠냠투게더 로고"
            backgroundColor="transparent"
          />
        </div>

        <Top
          title={
            <Top.TitleParagraph size={28}>
              {`냠냠투게더에서 토스로\n로그인할까요?`}
            </Top.TitleParagraph>
          }
        />
      </div>

      {/* 약관 동의 시트 — 항상 열림. 필수 약관 동의 후에만 시작 가능. */}
      <BottomSheet
        open
        onClose={back}
        portalContainer={getPortalRoot()}
        header={
          <BottomSheet.Header>
            {`냠냠투게더 로그인을 위해\n꼭 필요한 동의만 추렸어요`}
          </BottomSheet.Header>
        }
        cta={
          <>
            <BottomSheet.CTA onClick={handleLogin} disabled={!allChecked}>
              동의하고 시작하기
            </BottomSheet.CTA>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 12px" }}>
              <TextButton size="xsmall" variant="underline" onClick={back}>
                다음에
              </TextButton>
            </div>
          </>
        }
      >
        <div style={{ padding: "0 4px 8px" }}>
          {/* 전체 동의 */}
          <ConsentRow checked={allChecked} onToggle={toggleAll} bold>
            약관 전체 동의
          </ConsentRow>

          <div style={{ height: 1, background: colors.grey100, margin: "2px 12px 6px" }} />

          {TERMS.map((t) => (
            <div key={t.key}>
              <ConsentRow
                checked={agreed[t.key]}
                onToggle={() => toggleOne(t.key)}
                right={
                  <TextButton
                    size="xsmall"
                    variant="underline"
                    onClick={(e: ReactMouseEvent) => {
                      e.stopPropagation();
                      setOpenTerm((cur) => (cur === t.key ? null : t.key));
                    }}
                  >
                    보기
                  </TextButton>
                }
              >
                {t.label}
              </ConsentRow>
              {openTerm === t.key && (
                <div
                  style={{
                    margin: "0 12px 8px 40px",
                    padding: "12px 14px",
                    background: colors.grey50,
                    borderRadius: 10,
                  }}
                >
                  <Text typography="t7" color={colors.grey600}>
                    {t.body}
                  </Text>
                </div>
              )}
            </div>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

// 동의 항목 행 — 체크박스(시각) + 라벨. 행 전체 클릭으로 토글.
function ConsentRow({
  checked,
  onToggle,
  children,
  right,
  bold,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
  right?: ReactNode;
  bold?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px",
        cursor: "pointer",
      }}
    >
      <span style={{ pointerEvents: "none", display: "flex" }}>
        <Checkbox.Circle checked={checked} readOnly size={22} aria-hidden tabIndex={-1} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <Text
          typography="t5"
          fontWeight={bold ? "bold" : "medium"}
          color={checked ? colors.grey900 : colors.grey700}
        >
          {children}
        </Text>
      </span>
      {right}
    </div>
  );
}
