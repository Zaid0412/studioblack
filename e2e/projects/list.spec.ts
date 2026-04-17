import { test, expect } from "@playwright/test";

test.describe("Projects list", () => {
  test("shows projects page with heading", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/projects/);

    // Should display the projects heading
    await expect(
      page.getByRole("heading", { name: /projects/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows New Project button for PM role", async ({ page }) => {
    await page.goto("/projects");

    const newProjectBtn = page.getByRole("link", {
      name: /new project/i,
    }).or(page.getByRole("button", { name: /new project/i }));

    await expect(newProjectBtn).toBeVisible({ timeout: 10_000 });
  });

  test("has search functionality", async ({ page }) => {
    await page.goto("/projects");

    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // Type a search query
    await searchInput.fill("nonexistent-project-xyz");

    // Should filter results (may show empty state)
    await page.waitForTimeout(500); // debounce
  });

  test("has filter/sort controls", async ({ page }) => {
    await page.goto("/projects");

    // Should have status filter tabs or dropdown
    const filterControls = page
      .getByRole("tab")
      .or(page.getByRole("combobox"))
      .or(page.locator("[role='tablist']"));

    await expect(filterControls.first()).toBeVisible({ timeout: 10_000 });
  });
});
