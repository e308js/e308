import { expect, test } from "@playwright/test";

test("publishes distinct library, docs, examples, and original-game routes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/site-dist/");
  await expect(
    page.getByRole("heading", { name: "Build incremental games in TypeScript." }),
  ).toBeVisible();
  await expect(page.locator("#game")).toHaveCount(0);

  await page.getByRole("link", { name: "Docs", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Start building with e308" })).toBeVisible();
  await expect(page.getByText("pnpm add @e308/core @e308/ux")).toBeVisible();

  await page.getByRole("link", { name: "Examples", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Three original prototypes" })).toBeVisible();
  for (const name of ["Wireworks", "Cascade", "Hearth"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "Open Wireworks" }).click();
  await expect(page.locator("#game")).toHaveClass(/wireworks/);
  await expect(page.getByRole("button", { name: "Run the line +10 seconds" })).toBeHidden();
  await page.getByText("Developer tools", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Run the line +10 seconds" })).toBeVisible();
  await expect(page.locator("#ad-lab, #kittens-lab, .labs")).toHaveCount(0);

  for (const path of [
    "reference-labs.html",
    "examples/antimatter-dimensions/",
    "examples/paperclips/",
  ]) {
    expect((await page.request.get(`/site-dist/${path}`)).status()).toBe(404);
  }
});
