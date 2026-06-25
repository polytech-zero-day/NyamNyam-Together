import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "kopo-recommend-location",
  brand: {
    displayName: "냠냠투게더", // 화면에 노출될 앱의 한글 이름
    primaryColor: "#FF5F00", // 앱 기본 색상 (브랜드 주황)
    icon: "https://static.toss.im/appsintoss/52797/455becb5-5570-4f8c-aea3-96e5dd91ec65.png", // 콘솔에 업로드한 로고 URL이 있으면 넣기 (없으면 빈 칸 유지)
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});