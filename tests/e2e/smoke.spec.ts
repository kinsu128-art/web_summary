import { expect, test } from "@playwright/test";

test("health endpoint is live", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status(), "health endpoint must be 200").toBe(200);
});

test("jobs endpoint does not return 500", async ({ request }) => {
  const response = await request.get("/api/v1/jobs");
  expect([200, 503]).toContain(response.status());
});

test("system setup endpoint does not return 500", async ({ request }) => {
  const response = await request.get("/api/v1/system/setup");
  expect([200, 503]).toContain(response.status());
});

test("home page renders key sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "web_summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import URL" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Archive" })).toBeVisible();
});
