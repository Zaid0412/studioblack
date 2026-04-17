import { test as base, expect } from "@playwright/test";

/**
 * Extended test fixtures for StudioBlack E2E tests.
 *
 * Provides commonly used page objects and helpers.
 */
export const test = base.extend<{
  /** Navigate to dashboard and verify it loaded */
  dashboardPage: void;
}>({
  dashboardPage: async ({ page }, use) => {
    await page.goto("/dashboard");
    await expect(page.locator("nav")).toBeVisible();
    await use();
  },
});

export { expect } from "@playwright/test";
