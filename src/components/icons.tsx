import { Asset } from "@toss/tds-mobile";

export const BRAND_ORANGE = "#FF5F00";

// 앱 로고(주황 배경 + 흰 포크·스푼·위치핀). public/nyamnyam-logo.png 사용.
// NavBar(작은 라운드 사각) · LoginConsent(큰 원형) 등 여러 곳이 같은 파일을 공유한다.
export const APP_LOGO_SRC = "/nyamnyam-logo.png";

export function ForkSpoonIcon({ size = 88, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" fill="none" aria-hidden>
      <path
        d="M44 4c-6 0-11 4-11 10v18c0 4 2 7 5 8l-2 44h16l-2-44c3-1 5-4 5-8V14c0-6-5-10-11-10z"
        fill={color}
      />
      <path
        d="M26 4c-1 0-2 1-2 2v16c0 5 3 9 7 10v52h8V32c4-1 7-5 7-10V6c0-1-1-2-2-2s-2 1-2 2v14h-3V6c0-1-1-2-2-2s-2 1-2 2v14h-3V6c0-1-1-2-2-2z"
        fill={color}
      />
    </svg>
  );
}

export function CalendarPeopleIcon({ size = 200 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden>
      <rect x="20" y="40" width="160" height="140" rx="14" fill="#E8EEF7" />
      <rect x="20" y="40" width="160" height="36" rx="14" fill="#5B9BFF" />
      <rect x="20" y="60" width="160" height="16" fill="#5B9BFF" />
      <rect x="44" y="28" width="14" height="28" rx="4" fill="#3D3D3D" />
      <rect x="142" y="28" width="14" height="28" rx="4" fill="#3D3D3D" />
      <circle cx="78" cy="118" r="20" fill="#7FB3FF" />
      <path
        d="M58 156c0-11 9-20 20-20s20 9 20 20v8H58v-8z"
        fill="#7FB3FF"
      />
      <circle cx="118" cy="124" r="24" fill="#1F6BD6" />
      <path
        d="M94 164c0-13 11-24 24-24s24 11 24 24v6H94v-6z"
        fill="#1F6BD6"
      />
    </svg>
  );
}

export function IntroCardIllustration() {
  return (
    <div
      style={{
        position: "relative",
        background: BRAND_ORANGE,
        borderRadius: 20,
        width: "100%",
        aspectRatio: "1.45",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 110,
          height: 110,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.08)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -40,
          right: 40,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.08)",
        }}
      />
      <PinForkSpoon />
    </div>
  );
}

function PinForkSpoon() {
  return (
    <svg width="110" height="120" viewBox="0 0 110 120" fill="none" aria-hidden>
      <path
        d="M55 6c-13 0-24 11-24 24 0 18 24 38 24 38s24-20 24-38c0-13-11-24-24-24z"
        fill="#fff"
      />
      <circle cx="55" cy="30" r="8" fill={BRAND_ORANGE} />
      <path
        d="M30 70c-2 0-4 2-4 4v10c0 6 4 11 9 12v18h8V96c5-1 9-6 9-12V74c0-2-2-4-4-4s-2 1-2 2v10h-3V72c0-1-1-2-2-2s-2 1-2 2v10h-3V72c0-1-1-2-2-2s-2 1-2 2v10h-2v-8c0-2-2-4-2-4z"
        fill="#fff"
      />
      <path
        d="M70 70c-6 0-10 5-10 12v10c0 3 2 6 4 7l-2 15h12l-2-15c3-1 4-4 4-7V82c0-7-4-12-10-12z"
        fill="#fff"
      />
    </svg>
  );
}

// 상단 네비 앱 로고. 첨부 로고(주황 배경 + 흰 포크·스푼·핀)를 정사각형으로 렌더한다.
// 로고 PNG 자체에 주황 배경이 포함돼 있어 별도 배경 div 가 필요 없고, 라운드만 frameShape 로 준다.
export function AppLogoMark({ size = 24 }: { size?: number }) {
  return (
    <Asset.Image
      src={APP_LOGO_SRC}
      frameShape={{ width: size, height: size, radius: 6 }}
      scaleType="fit"
      alt="냠냠투게더 로고"
      backgroundColor="transparent"
    />
  );
}
