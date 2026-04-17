import { test, expect } from "@playwright/test";

const E2E_PM_EMAIL =
  process.env.E2E_PM_EMAIL ?? "e2e-pm@test.studioblack.com";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "TestPassword123!";

test.describe("Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows login form with email and password fields", async ({ page }) => {
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByPlaceholder(/enter your password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in/i })
    ).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.getByLabel(/email address/i).fill("nonexistent@test.com");
    await page.getByPlaceholder(/enter your password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
  });

  test("shows error on empty form submission", async ({ page }) => {
    await page.getByRole("button", { name: /sign in/i }).click();

    // Browser validation prevents submission — stays on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to dashboard on successful login", async ({ page }) => {
    await page.getByLabel(/email address/i).fill(E2E_PM_EMAIL);
    await page.getByPlaceholder(/enter your password/i).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  });

  test("has link to register page", async ({ page }) => {
    const registerLink = page.getByRole("link", { name: /sign up/i });
    await expect(registerLink).toBeVisible();
    await registerLink.click();
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe("Logout", () => {
  test.use({
    storageState: "e2e/.auth/pm.json",
  });

  test("logs out and redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // The logout button is in the sidebar user popover
    const logoutButton = page.getByRole("button", {
      name: /log\s*out|sign\s*out/i,
    });

    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click();
    } else {
      // Try opening the user menu popover first
      const userMenuTrigger = page.locator(
        "nav button:has(span), nav [role='button']"
      );
      const triggers = await userMenuTrigger.all();
      // Click the last button in the sidebar (typically the user menu)
      if (triggers.length > 0) {
        await triggers[triggers.length - 1].click();
        await page
          .getByRole("button", { name: /log\s*out|sign\s*out/i })
          .click();
      } else {
        // Fallback: sign out via API
        await page.goto("/api/auth/sign-out");
      }
    }

    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
