import { defineConfig, defaultExclude } from "vitest/config";
import path from "path";
import { HOOK_TEST_FILES } from "./vitest.hooks-tests";

const alias = { "@": path.resolve(__dirname, "src") };

/**
 * Two projects in one config so a single `vitest run` covers both environments
 * and emits one report — the old two-config setup needed two processes and a
 * JSON merge in CI, and its include/exclude lists could (and did) drift out of
 * sync, running 19 files twice.
 *
 * - `node`: API + unit tests, with the global mocks in `src/test/setup.ts`.
 * - `dom` : React hook/component tests, which need a DOM (see HOOK_TEST_FILES).
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          include: ["src/test/**/*.test.{ts,tsx}"],
          exclude: [...defaultExclude, ...HOOK_TEST_FILES],
          setupFiles: ["src/test/setup.ts"],
          environment: "node",
          // Restores mock implementations between tests; test files also call
          // vi.clearAllMocks() in beforeEach to reset call history/counters.
          restoreMocks: true,
          env: { NODE_ENV: "test" },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "dom",
          include: [...HOOK_TEST_FILES],
          environment: "jsdom",
          restoreMocks: true,
          env: { NODE_ENV: "test" },
        },
      },
    ],
  },
});
