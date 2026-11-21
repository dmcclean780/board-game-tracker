import { test, expect } from "@playwright/test";

test("web app renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Open up App.tsx/)).toBeVisible();
});

test("backend and database are up", async ({ request }) => {
  const res = await request.get("http://localhost:3000/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});
