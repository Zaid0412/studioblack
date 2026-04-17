import { test, expect } from "@playwright/test";

test.describe("Tasks page", () => {
  test("shows tasks page with heading", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page).toHaveURL(/\/tasks/);

    await expect(
      page.getByRole("heading", { name: /tasks/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("has create task button", async ({ page }) => {
    await page.goto("/tasks");

    const createBtn = page.getByRole("button", {
      name: /new task|add task|create task/i,
    });
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
  });

  test("has filter controls", async ({ page }) => {
    await page.goto("/tasks");

    // Should have some filter or search UI
    const filterUI = page
      .getByPlaceholder(/search/i)
      .or(page.getByRole("combobox"))
      .or(page.getByText(/filter/i));

    await expect(filterUI.first()).toBeVisible({ timeout: 10_000 });
  });
});
