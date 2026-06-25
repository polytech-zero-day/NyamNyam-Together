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

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
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
          background:
            toast.type === "error" ? "rgba(229,57,53,0.95)" : "rgba(25,31,40,0.92)",
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
