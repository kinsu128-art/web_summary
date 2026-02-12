#!/usr/bin/env node

import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] || "https://websummary.vercel.app";
const token = `pw-${Date.now()}`.toLowerCase();
const title = `Playwright ${token}`;
const marker = `marker-${token}`;

const log = (msg) => console.log(`[live-ui-check] ${msg}`);

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByPlaceholder("New tag name").fill(token);
    await page.getByRole("button", { name: "Create Tag" }).click();
    await page.getByText("Tag created.").waitFor({ timeout: 20000 });
    log("Create Tag button: OK");

    await page.getByPlaceholder("https://example.com/article").fill("https://example.com");
    await page.getByPlaceholder("My study title").fill(title);
    await page.getByPlaceholder("react, hooks").fill(token);
    await page.getByRole("button", { name: "Clean and Save" }).click();
    await page.getByText("Saved successfully.").waitFor({ timeout: 120000 });
    log("Clean and Save button: OK");

    await page.getByRole("combobox", { name: "Tag" }).selectOption({ label: token });
    await page.getByRole("button", { name: "Apply Filters" }).click();
    const item = page.locator("article.item").filter({ hasText: title }).first();
    await item.waitFor({ timeout: 30000 });
    await item.getByRole("link", { name: "Read" }).click();
    log("Read link button: OK");

    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("textarea").first().fill(`# ${title}\n\n${marker}`);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.getByText("Saved.").waitFor({ timeout: 30000 });
    log("Save Changes button: OK");

    page.once("dialog", async (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL(/\/$/, { timeout: 30000 });
    log("Delete document button: OK");

    const tagChip = page.getByRole("button", { name: new RegExp(`#${token}`) }).first();
    await tagChip.waitFor({ timeout: 30000 });
    await tagChip.click();
    await page.getByText("Tag deleted.").waitFor({ timeout: 20000 });
    log("Delete tag chip button: OK");

    log("ALL BUTTON FLOWS PASSED");
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error("[live-ui-check] FAILED", error instanceof Error ? error.message : error);
  process.exit(1);
});
