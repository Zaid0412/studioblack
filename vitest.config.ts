import { defineConfig, defaultExclude } from "vitest/config";
import path from "path";
import { HOOK_TEST_FILES } from "./vitest.hooks-tests";

export default defineConfig({
  test: {
    include: ["src/test/**/*.test.{ts,tsx}"],
    // Hook/component tests are owned by `vitest.config.hooks.ts` (jsdom). They
    // must be excluded here or they run under both configs — the exclude list
    // had drifted out of sync with that config's include list, so 19 files were
    // executing (and being counted) twice.
    exclude: [...defaultExclude, ...HOOK_TEST_FILES],
    setupFiles: ["src/test/setup.ts"],
    environment: "node",
    // Restores mock implementations between tests; test files also call
    // vi.clearAllMocks() in beforeEach to reset call history/counters.
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
