// 토스 앱(미니앱 WebView) 안에서 실행 중인지 판별.
// browser-shim이 PC 브라우저에 mock ReactNativeWebView를 주입하므로, 그 플래그를 먼저 제외한다
// (안 그러면 appLogin/closeView 등 네이티브 브리지 호출이 영영 pending).
export function isInTossApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    ReactNativeWebView?: unknown;
    __NYAM_BROWSER_SHIM__?: boolean;
  };
  if (w.__NYAM_BROWSER_SHIM__) return false;
  return w.ReactNativeWebView != null;
}
