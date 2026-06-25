// 브라우저(npm run dev) 환경에서 토스 앱 전용 브리지가 throw 하지 않도록 mock 주입.
//
// 배경:
//   @apps-in-toss/web-bridge 의 모든 호출은 결국 nativeWindow(=window) 의
//   세 가지 슬롯에 의존한다.
//     1) window.ReactNativeWebView           — postMessage 송신 채널
//     2) window.__GRANITE_NATIVE_EMITTER     — 비동기 응답 이벤트 emitter
//     3) window.__CONSTANT_HANDLER_MAP       — 동기 constant 값 lookup
//   토스 앱(WebView) 안에서는 native 측이 세 슬롯을 모두 채워주지만, PC 브라우저엔
//   아무것도 없어서 호출 시 "ReactNativeWebView is not available" /
//   "<method> is not a constant handler" 류 에러가 던져진다.
//   이게 BottomCTA / BottomSheet 내부의 SafeAreaInsets 조회 경로에 걸려 컴포넌트
//   하단(시트 CTA 버튼 영역)이 렌더 자체가 안 되는 증상을 만든다.
//
// 해결:
//   "ReactNativeWebView 가 없는 환경"만 골라(=토스 앱이 아님) 안전한 더미를
//   주입한다. 실기기에선 ReactNativeWebView 가 이미 있으므로 가드 조건에 걸려
//   아무 일도 안 한다 → 실기기 동작에 영향 없음.
//
// 단, 비동기 브리지(appLogin 등)는 응답이 영영 안 오므로 (mock emitter 가 빈
// no-op) 호출하면 promise 가 영원히 pending. PC 에선 토스 로그인 자체를 안
// 누른다는 전제. (LoginConsent 의 "토스 로그인 실패"는 정상 동작이라 사용자
// 확인 — 그건 try/catch 가 잡아 토스트로 안내.)
//
// 이 모듈은 main.tsx 의 다른 import 보다 먼저 import 되어야 한다.
//   (다른 모듈이 모듈 평가 단계에서 즉시 브리지를 호출하지 않더라도,
//    AITProvider 등이 mount 직후 호출하므로 React 렌더 전에 셋업하면 충분히 안전.)

interface ConstantHandlerMap {
  [method: string]: unknown;
}

interface BrowserShimGlobals {
  ReactNativeWebView?: { postMessage: (msg: string) => void };
  __GRANITE_NATIVE_EMITTER?: {
    on: (event: string, cb: (data: unknown) => void) => () => void;
  };
  __CONSTANT_HANDLER_MAP?: ConstantHandlerMap;
  // 이 mock 이 주입됐다는 표식. "여기는 실제 토스 웹뷰가 아니다" 를 코드가 판별할 때 쓴다.
  // (shim 이 ReactNativeWebView 를 채우므로 그 존재만으론 실기기와 구분 불가.)
  __NYAM_BROWSER_SHIM__?: boolean;
}

declare global {
  // Window 에 브리지 슬롯을 직접 병합한다. (빈 interface extends 는 lint 규칙에 걸림)
  interface Window {
    ReactNativeWebView?: BrowserShimGlobals["ReactNativeWebView"];
    __GRANITE_NATIVE_EMITTER?: BrowserShimGlobals["__GRANITE_NATIVE_EMITTER"];
    __CONSTANT_HANDLER_MAP?: BrowserShimGlobals["__CONSTANT_HANDLER_MAP"];
    __NYAM_BROWSER_SHIM__?: BrowserShimGlobals["__NYAM_BROWSER_SHIM__"];
  }
}

if (typeof window !== "undefined" && window.ReactNativeWebView == null) {
  // 0) "지금은 실제 토스 웹뷰가 아니다" 표식. 비동기 브리지(appLogin 등)를
  //    건너뛸지 판단할 때 사용한다.
  window.__NYAM_BROWSER_SHIM__ = true;

  // 1) 송신 채널 — no-op. 토스 앱에선 native 가 채움.
  window.ReactNativeWebView = { postMessage: () => {} };

  // 2) 비동기 응답 emitter — no-op subscriber.
  //    PC 에선 비동기 브리지 응답이 영영 안 오니 호출 자체를 안 하는 게 정상.
  window.__GRANITE_NATIVE_EMITTER = { on: () => () => {} };

  // 3) 동기 constant 값. 호출되는 메소드만 명시적으로 채운다.
  //    여기 없는 메소드를 누가 호출하면 SDK 가 "<method> is not a constant handler"
  //    를 던지는데, 새 메소드가 필요해질 때마다 여기 추가하는 게
  //    "모든 메소드 흡수" 보다 디버깅하기 쉽다.
  window.__CONSTANT_HANDLER_MAP = {
    // BottomCTA / BottomSheet 내부 SafeArea hook 이 호출. inset 0 이면
    // 브라우저에선 SafeArea 영역 없음 = padding-bottom 폴백 20px 만 적용됨.
    getSafeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    // isMinVersionSupported() 가 환경 확인 시 호출. "sandbox" 면 항상 true 반환.
    getOperationalEnvironment: "sandbox",
    // 아래 둘은 isMinVersionSupported 가 sandbox 아닐 때만 추가로 본다.
    // sandbox 로 잡혀서 사실상 호출 안 되지만 안전망으로 채워둠.
    getTossAppVersion: "0.0.0",
    getPlatformOS: "ios",
  };
}

export {};
