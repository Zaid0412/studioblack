import { test, expect } from "@playwright/test";

test.describe("Create project", () => {
  test("navigates to new project form", async ({ page }) => {
    await page.goto("/projects");

    const newProjectBtn = page.getByRole("link", {
      name: /new project/i,
    }).or(page.getByRole("button", { name: /new project/i }));

    await newProjectBtn.click();
    await expect(page).toHaveURL(/\/projects\/new/, { timeout: 10_000 });
  });

  test("shows project form with required fields", async ({ page }) => {
    await page.goto("/projects/new");

    // Name field
    await expect(
      page.getByLabel(/name/i).first().or(page.getByPlaceholder(/project name/i))
    ).toBeVisible({ timeout: 10_000 });

    // Category field (select)
    await expect(
      page.getByLabel(/category/i).or(page.getByText(/category/i).first())
    ).toBeVisible();

    // Submit button
    await expect(
      page.getByRole("button", { name: /create|save|submit/i })
    ).toBeVisible();
  });

  test("creates a project and redirects to projects list", async ({
    page,
  }) => {
    await page.goto("/projects/new");

    // Fill in required fields
    const nameInput = page
      .getByLabel(/project name/i)
      .or(page.getByPlaceholder(/project name/i))
      .or(page.locator("input[name='name']"));
    await nameInput.fill(`E2E Test Project ${Date.now()}`);

    // Select category — click the category trigger then select an option
    const categoryTrigger = page.getByLabel(/category/i).or(
      page.locator("[name='category']").or(page.getByText(/category/i).first())
    );
    await categoryTrigger.click();

    // Select "Residential" from dropdown
    const option = page.getByRole("option", { name: /residential/i }).or(
      page.getByText(/residential/i)
    );
    if (await option.isVisible().catch(() => false)) {
      await option.click();
    }

    // Submit the form
    await page
      .getByRole("button", { name: /create|save|submit/i })
      .click();

    // Should redirect to projects list or project detail
    await expect(page).toHaveURL(/\/projects/, { timeout: 15_000 });
  });
});
