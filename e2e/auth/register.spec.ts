import { test, expect } from "@playwright/test";

test.describe("Register", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
  });

  test("shows registration form with all fields", async ({ page }) => {
    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirm-password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create account/i })
    ).toBeVisible();
  });

  test("shows validation error when passwords don't match", async ({
    page,
  }) => {
    await page.getByLabel(/full name/i).fill("Test User");
    await page.getByLabel(/email address/i).fill("test-mismatch@test.studioblack.com");
    await page.locator("#password").fill("TestPassword123!");
    await page.locator("#confirm-password").fill("DifferentPassword!");

    await page.getByRole("button", { name: /create account/i }).click();

    // Should stay on register page (validation prevents submission)
    await expect(page).toHaveURL(/\/register/);
  });

  test("has link to login page", async ({ page }) => {
    const loginLink = page.getByRole("link", { name: /sign in/i });
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });
});
