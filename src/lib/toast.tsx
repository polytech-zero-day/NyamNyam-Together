// 경량 전역 토스트. 컴포넌트 밖(react-query 콜백 등)에서도 showToast()로 띄울 수 있게
// 모듈 레벨 구독자 패턴을 쓴다. <ToastHost/>를 앱 루트(프로바이더 안)에 한 번 렌더.
import { useEffect, useState } from "react";

type ToastType = "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}
type Listener = (t: ToastItem) => void;

let listeners: Listener[] = [];
let seq = 0;

export function showToast(message: string, type: ToastType = "info"): void {
  const item: ToastItem = { id: ++seq, message, type };
  listeners.forEach((l) => l(item));
}

const AUTO_DISMISS_MS = 2800;

export function ToastHost() {
  const [toast, setToast] = useState<ToastItem | null>(null);

  useEffect(() => {
    const l: Listener = (t) => setToast(t);
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  // error 는 중앙 경고 모달(백드롭으로 하단 CTA 오탭 차단), info 는 상단 토스트.
  const dismissMs = toast?.type === "error" ? 4000 : AUTO_DISMISS_MS;
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), dismissMs);
    return () => clearTimeout(timer);
  }, [toast, dismissMs]);

  if (!toast) return null;

  // ── error: 화면 중앙 경고 모달 ──────────────────────────────────────────────
  if (toast.type === "error") {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-live="assertive"
        onClick={() => setToast(null)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 32px",
          zIndex: 1000,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 320,
            background: "#fff",
            borderRadius: 20,
            padding: "28px 24px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "#FFECEC",
              color: "#E53935",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            !
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.5,
              color: "#191F28",
              textAlign: "center",
              wordBreak: "keep-all",
            }}
          >
            {toast.message}
          </p>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              marginTop: 6,
              width: "100%",
              border: "none",
              borderRadius: 12,
              padding: "13px 0",
              background: "#F2F4F6",
              color: "#4E5968",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  // ── info: 상단 토스트(하단 CTA와 겹치지 않게) ──────────────────────────────
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: "calc(16px + env(safe-area-inset-top, 0px))",
        display: "flex",
        justifyContent: "center",
        padding: "0 20px",
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: "100%",
          background: "rgba(25,31,40,0.92)",
          color: "#fff",
          padding: "12px 16px",
          borderRadius: 12,
          fontSize: 14,
          lineHeight: 1.45,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          wordBreak: "keep-all",
        }}
      >
        {toast.message}
      </div>
    </div>
  );
}
