import { defineConfig } from "vitest/config";
import path from "path";
import { HOOK_TEST_FILES } from "./vitest.hooks-tests";

/** Separate config for React hook tests (jsdom environment, no global setup). */
export default defineConfig({
  test: {
    include: HOOK_TEST_FILES,
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
