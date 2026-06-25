// TDS BottomSheet 의 portal 대상.
// 기본값은 document.body — 데스크탑에서 #root가 375px 프레임이라 시트가
// viewport 전체로 퍼지면서 프레임 밖으로 나가버린다.
// #root 안으로 portal 하고, App.css 에서 #root 에 transform 을 줘서
// fixed-position 자식들이 #root 기준으로 자리잡도록 한다(둘이 한 세트).
let cached: HTMLElement | null = null;

export function getPortalRoot(): HTMLElement | null {
  if (cached != null) return cached;
  if (typeof document === "undefined") return null;
  cached = document.getElementById("root");
  return cached;
}
