import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/test/**/*.test.{ts,tsx}"],
    exclude: ["src/test/unit/hooks.test.tsx"],
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
