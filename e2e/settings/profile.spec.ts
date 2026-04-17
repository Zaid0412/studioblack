import { test, expect } from "@playwright/test";

test.describe("Settings page", () => {
  test("shows settings page with profile section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);

    // Should show settings heading
    await expect(
      page.getByRole("heading", { name: /settings/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("displays profile section with name and email", async ({ page }) => {
    await page.goto("/settings");

    // Should show profile section with user's name field
    const nameInput = page.getByLabel(/name/i).first().or(
      page.locator("input[name='name']")
    );
    await expect(nameInput).toBeVisible({ timeout: 10_000 });

    // Should have email field (may be read-only)
    const emailField = page.getByLabel(/email/i).first().or(
      page.locator("input[name='email']")
    );
    await expect(emailField).toBeVisible();
  });

  test("allows updating profile name", async ({ page }) => {
    await page.goto("/settings");

    const nameInput = page.getByLabel(/name/i).first().or(
      page.locator("input[name='name']")
    );
    await expect(nameInput).toBeVisible({ timeout: 10_000 });

    // Store original name
    const originalName = await nameInput.inputValue();

    // Change name
    await nameInput.clear();
    await nameInput.fill("E2E Updated Name");

    // Find and click save button in the profile section
    const saveBtn = page.getByRole("button", { name: /save|update/i }).first();
    await saveBtn.click();

    // Wait for save to complete (success toast or button state change)
    await page.waitForTimeout(2000);

    // Restore original name
    await nameInput.clear();
    await nameInput.fill(originalName);
    await saveBtn.click();
    await page.waitForTimeout(1000);
  });

  test("shows password section", async ({ page }) => {
    await page.goto("/settings");

    // Password section should be visible for PM role
    const passwordSection = page.getByText(/password/i).first();
    await expect(passwordSection).toBeVisible({ timeout: 10_000 });
  });
});
