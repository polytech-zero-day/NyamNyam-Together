// 앱인토스 네이티브 액션 래퍼 — 토스 앱 안에선 SDK, PC 브라우저에선 안전한 폴백.
import { closeView, openURL, share } from "@apps-in-toss/web-framework";
import { isInTossApp } from "./tossEnv";

/** 미니앱 화면 닫기. 브라우저에선 no-op(닫을 네이티브 뷰 없음). */
export async function closeApp(): Promise<void> {
  if (!isInTossApp()) return;
  try {
    await closeView();
  } catch (err) {
    console.error("closeView 실패:", err);
  }
}

/** 텍스트 공유. 브라우저에선 클립보드 복사로 폴백. */
export async function shareText(message: string): Promise<void> {
  if (!isInTossApp()) {
    try {
      await navigator.clipboard?.writeText(message);
    } catch {
      // 클립보드 불가 환경 — 조용히 무시
    }
    return;
  }
  try {
    await share({ message });
  } catch (err) {
    console.error("share 실패:", err);
  }
}

/** 외부 URL 열기(지도 등). 브라우저에선 새 탭. */
export async function openExternal(url: string): Promise<void> {
  if (!url) return;
  if (!isInTossApp()) {
    if (typeof window !== "undefined") window.open(url, "_blank");
    return;
  }
  try {
    await openURL(url);
  } catch {
    if (typeof window !== "undefined") window.open(url, "_blank");
  }
}
