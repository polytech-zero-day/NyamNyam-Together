import { useApp } from "../store";
import { closeApp } from "../lib/appActions";
import { AppLogoMark } from "./icons";

export function NavBar() {
  const { back, screen } = useApp();
  const canBack = screen !== "intro";

  return (
    <header
      style={{
        height: "var(--navbar-height)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          onClick={canBack ? back : undefined}
          aria-label="뒤로가기"
          disabled={!canBack}
          style={{
            background: "none",
            border: "none",
            padding: 8,
            cursor: canBack ? "pointer" : "default",
            opacity: canBack ? 1 : 0.3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft />
        </button>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <AppLogoMark size={22} />
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#191F28",
              letterSpacing: "-0.01em",
            }}
          >
            냠냠투게더
          </span>
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "#F2F4F6",
          borderRadius: 999,
          padding: "6px 12px",
        }}
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={() => {
            void closeApp();
          }}
          style={{
            background: "none",
            border: "none",
            padding: "0 4px",
            color: "#4E5968",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    </header>
  );
}

function ChevronLeft() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M14 5l-6 6 6 6"
        stroke="#191F28"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
