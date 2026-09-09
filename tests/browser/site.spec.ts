import { expect, test } from "@playwright/test";

test("deployable site contains every original game and no reference clone", async ({ page }) => {
  await page.goto("/site-dist/index.html?run=public-site");
  await expect(page.getByRole("heading", { name: /Build incremental games/ })).toBeVisible();
  await expect(page.getByText("@e308/core", { exact: true })).toBeVisible();
  await expect(page.getByText("MIT licensed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wireworks", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cascade", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cascade" })).toBeVisible();
  await page.getByRole("button", { name: "Hearth", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hearth" })).toBeVisible();
  await expect(page.locator("#ad-lab, #kittens-lab, .labs")).toHaveCount(0);

  const response = await page.request.get("/site-dist/reference-labs.html");
  expect(response.status()).toBe(404);
});
