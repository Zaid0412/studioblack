import { test, expect } from "@playwright/test";

/**
 * Navigation smoke tests — verify sidebar links work for PM role.
 */

test.use({ storageState: "e2e/.auth/pm.json" });

test.describe("Sidebar navigation", () => {
  const navItems = [
    { name: /dashboard/i, url: /\/dashboard/ },
    { name: /projects/i, url: /\/projects/ },
    { name: /tasks/i, url: /\/tasks/ },
    { name: /settings/i, url: /\/settings/ },
  ];

  for (const item of navItems) {
    test(`navigates to ${item.url}`, async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

      // Find and click the sidebar nav link
      const link = page
        .locator("nav")
        .getByRole("link", { name: item.name })
        .first();

      await link.click();
      await expect(page).toHaveURL(item.url, { timeout: 10_000 });
    });
  }
});
