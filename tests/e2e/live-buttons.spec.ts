import { expect, test } from "@playwright/test";

test("buttons work with real data flow", async ({ page }) => {
  const token = `pw-${Date.now()}`.toLowerCase();
  const title = `Playwright ${token}`;
  const appendText = `playwright-check-${token}`;

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "web_summary" })).toBeVisible();

  // 1) Create tag
  await page.getByPlaceholder("New tag name").fill(token);
  await page.getByRole("button", { name: "Create Tag" }).click();
  await expect(page.getByText("Tag created.")).toBeVisible();

  // 2) Import document with the created tag
  await page.getByPlaceholder("https://example.com/article").fill("https://example.com");
  await page.getByPlaceholder("My study title").fill(title);
  await page.getByPlaceholder("react, hooks").fill(token);
  await page.getByRole("button", { name: "Clean and Save" }).click();
  await expect(page.getByText("Saved successfully.")).toBeVisible({ timeout: 90_000 });

  // 3) Filter by tag and open the imported doc
  await page.getByLabel("Tag").selectOption({ label: token });
  await page.getByRole("button", { name: "Apply Filters" }).click();

  const targetItem = page.locator("article.item").filter({ hasText: title }).first();
  await expect(targetItem).toBeVisible({ timeout: 20_000 });
  await targetItem.getByRole("link", { name: "Read" }).click();

  // 4) Edit and save in detail page
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Edit" }).click();

  const markdownArea = page.locator("textarea").first();
  await markdownArea.fill(`# ${title}\n\n${appendText}`);
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByText(appendText)).toBeVisible();

  // 5) Delete the document
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/$/);

  // 6) Delete the created tag
  const tagChip = page.getByRole("button", { name: new RegExp(`#${token}`) }).first();
  await expect(tagChip).toBeVisible({ timeout: 20_000 });
  await tagChip.click();
  await expect(page.getByText("Tag deleted.")).toBeVisible();
});
