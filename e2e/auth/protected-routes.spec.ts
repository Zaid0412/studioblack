import { test, expect } from "@playwright/test";

test.describe("Protected routes redirect to login", () => {
  const protectedRoutes = [
    "/dashboard",
    "/projects",
    "/tasks",
    "/settings",
    "/organisation",
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects unauthenticated users to /login`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });
  }
});
