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
  await expect(page.locator("#host-status")).toContainText("wireworks");
  await page.getByRole("button", { name: "New save" }).click();
  await expect(page.locator("#host-status")).toHaveText("Started a new save");
  await expect(page.getByRole("button", { name: "Make a clip" })).toBeEnabled();
  await page.getByRole("button", { name: "Make a clip" }).click();
  await expect(page.getByText("Clip inventory: 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run production for 10 seconds" })).toBeHidden();
  await page.getByText("Developer tools", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Run production for 10 seconds" })).toBeVisible();
  await expect(page.locator("#ad-lab, #kittens-lab, .labs")).toHaveCount(0);
  const wireworksText = await page.locator("#game").innerText();
  await expect.poll(() => page.locator("#game").innerText()).not.toBe(wireworksText);

  await page.goto("/site-dist/examples/hearth/");
  await page.getByRole("button", { name: "New save" }).click();
  await expect(page.locator("#host-status")).toHaveText("Started a new save");
  await expect(page.getByText("1 of 4 workers available.", { exact: false })).toBeVisible();
  await page.getByLabel("miner").evaluate((input: HTMLInputElement) => {
    input.value = "1";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByText("0 of 4 workers available.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("scholar")).toHaveAttribute("max", "0");

  await page.goto("/site-dist/examples/cascade/");
  await expect(page.locator("#host-status")).toContainText("cascade");
  await page.getByRole("button", { name: "New save" }).click();
  await expect(page.locator("#host-status")).toHaveText("Started a new save");
  await expect(page.getByRole("button", { name: "Buy Tier 1 generator" })).toBeEnabled();
  await page.getByRole("button", { name: "Buy Tier 1 generator" }).click();
  await expect(page.getByText("Tier 1 generators: 1", { exact: true })).toBeVisible();
  const advance = page.getByRole("button", { name: "Advance one minute" });
  await advance.click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1_250);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  for (const path of [
    "reference-labs.html",
    "examples/antimatter-dimensions/",
    "examples/paperclips/",
  ]) {
    expect((await page.request.get(`/site-dist/${path}`)).status()).toBe(404);
  }
});
