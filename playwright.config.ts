import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration.
 *
 * Expects the dev server to be running at http://localhost:3000.
 * Auth storage states are saved per role in e2e/.auth/.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",
  timeout: 60_000,

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    /* ── Auth setup (runs first, no dependencies) ── */
    { name: "setup", testDir: "./e2e", testMatch: /global-setup\.ts/, },

    /* ── Tests that run as PM ── */
    {
      name: "pm",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/pm.json",
      },
      dependencies: ["setup"],
      testMatch: /(\/(projects|tasks)\/.*\.spec\.ts|navigation\.spec\.ts)/,
    },

    /* ── Auth tests (no pre-existing session) ── */
    {
      name: "auth",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /\/auth\/.*\.spec\.ts/,
    },

    /* ── Settings tests (PM session) ── */
    {
      name: "settings",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/pm.json",
      },
      dependencies: ["setup"],
      testMatch: /\/settings\/.*\.spec\.ts/,
    },
  ],

  /* Start the app server automatically if not already running.
     CI uses the production build (`npm run start`), local uses dev server. */
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
