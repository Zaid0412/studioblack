import { test as setup, expect } from "@playwright/test";

/**
 * Authenticate as each role and save browser storage state.
 *
 * This runs once before all test projects that depend on "setup".
 * Each role logs in via the UI and persists cookies/localStorage to a JSON file.
 *
 * Test users must exist in the database with emailVerified = true.
 * Use `npm run seed:e2e` to create them.
 */

const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "TestPassword123!";

const roles = [
  {
    name: "pm",
    email: process.env.E2E_PM_EMAIL ?? "e2e-pm@test.studioblack.com",
    storageState: "e2e/.auth/pm.json",
  },
  {
    name: "architect",
    email:
      process.env.E2E_ARCHITECT_EMAIL ?? "e2e-architect@test.studioblack.com",
    storageState: "e2e/.auth/architect.json",
  },
];

for (const role of roles) {
  setup(`authenticate as ${role.name}`, async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/email address/i).fill(role.email);
    await page.getByPlaceholder(/enter your password/i).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for redirect to dashboard (dev server can be slow on first login)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });

    await page.context().storageState({ path: role.storageState });
  });
}
