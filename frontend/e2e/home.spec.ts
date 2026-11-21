import { test, expect } from "@playwright/test";

test("web build renders the home screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Open up App.tsx/)).toBeVisible();
});
