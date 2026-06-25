import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// 단위/컴포넌트 테스트(jsdom). Storybook 빌드와 분리된 독립 설정.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: false,
    css: false,
  },
});
