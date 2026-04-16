import { defineConfig } from "vitest/config";
import path from "path";

/** Separate config for React hook tests (jsdom environment, no global setup). */
export default defineConfig({
  test: {
    include: ["src/test/unit/hooks.test.tsx"],
    environment: "jsdom",
    restoreMocks: true,
    env: {
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
