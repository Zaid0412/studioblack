import { test, expect } from "@playwright/test";

/**
 * Verify that authenticated users are redirected away from auth pages.
 * Uses PM storage state (depends on setup project).
 */
test.describe("Auth pages redirect authenticated users", () => {
  test("login page redirects to dashboard when already authenticated", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test("register page redirects to dashboard when already authenticated", async ({
    page,
  }) => {
    await page.goto("/register");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});
