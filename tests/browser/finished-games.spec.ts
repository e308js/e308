import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const durations: number[] = [];
    new PerformanceObserver((list) => {
      durations.push(...list.getEntries().map((entry) => entry.duration));
    }).observe({ type: "longtask", buffered: true });
    Object.assign(window, { e308LongTasks: durations });
  });
  await page.goto(`/examples/finished-games/index.html?run=${testInfo.testId}`);
  await expect(page.locator("#host-status")).toContainText("wireworks");
});

test("plays and persists each distinct finished-game composition", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await expect(page.locator("#game")).toHaveClass(/wireworks/);
  const before = await gameTime(page);
  await page.getByRole("button", { name: "Run production for 10 seconds" }).click();
  const afterWait = await gameTime(page);
  expect(afterWait).toBeGreaterThanOrEqual(before + 10_000);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#host-status")).toHaveText("Saved locally");
  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.locator("#host-status")).toHaveText("Exported current save");
  const raw = await page.getByLabel("Exported save").inputValue();
  expect(raw).toContain("wireworks");
  await page.getByRole("button", { name: "New save" }).click();
  await expect(page.locator("#host-status")).toHaveText("Started a new save");
  await page.getByLabel("Exported save").fill(raw);
  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.locator("#host-status")).toHaveText("Imported save");
  expect(await gameTime(page)).toBeGreaterThanOrEqual(afterWait);

  await page.getByRole("button", { name: "Cascade" }).click();
  await page.waitForTimeout(100);
  expect(pageErrors).toEqual([]);
  await expect(page.locator("#game")).toHaveClass(/cascade/);
  await expect(page.getByRole("heading", { name: "Cascade" })).toBeVisible();
  await page.getByRole("button", { name: "Hearth" }).click();
  await expect(page.locator("#game")).toHaveClass(/hearth/);
  await expect(page.getByRole("table", { name: "Seasonal production ledger" })).toBeVisible();

  const longTasks = await page.evaluate(
    () => (window as Window & { e308LongTasks?: number[] }).e308LongTasks ?? [],
  );
  expect(longTasks.filter((duration) => duration > 50)).toEqual([]);
});

test("keeps reference clones on a separate evidence-only page", async ({ page }) => {
  await expect(page.locator("#ad-lab, #kittens-lab, #array-lab, #paperclips-lab")).toHaveCount(0);
  await page.goto("/examples/finished-games/reference-labs.html");
  await page.getByRole("button", { name: "Tick 100 ms" }).click();
  await expect(page.locator("#ad-lab output")).toHaveText("legal action applied");
  await page.getByRole("button", { name: "Craft beam" }).click();
  await expect(page.locator("#kittens-lab output")).toHaveText("blocked by requirements");
  await page.locator("#kittens-lab").getByRole("button", { name: "Save round-trip" }).click();
  await expect(page.locator("#kittens-lab output")).toHaveText(/restored \d+ bytes/);
  await page.locator("#array-lab").getByLabel("Source case").selectOption("2");
  await expect(page.locator("#array-lab pre")).toContainText("1e180");
  await page.locator("#array-lab").getByRole("button", { name: "Advance 16 ms" }).click();
  await expect(page.locator("#array-lab output")).toHaveText("legal action applied");
  await page.locator("#paperclips-lab").getByLabel("Source case").selectOption("3");
  await page
    .locator("#paperclips-lab")
    .getByRole("button", { name: "Enter next universe" })
    .click();
  await expect(page.locator("#paperclips-lab pre")).toContainText('"phase": "complete"');
});

test("keeps primary choices usable at a touch viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["Wireworks", "Cascade", "Hearth"]) {
    await page.getByRole("button", { name, exact: true }).click();
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator("#game")).toBeVisible();
  }
});

async function gameTime(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const api = (
      window as Window & {
        e308Finished?: { snapshot(): { gameTimeMs: number } };
      }
    ).e308Finished;
    if (!api) throw new TypeError("finished-game API unavailable");
    return api.snapshot().gameTimeMs;
  });
}
