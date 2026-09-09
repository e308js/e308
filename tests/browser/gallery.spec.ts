import { expect, test } from "@playwright/test";

test("two renderers stay synchronized through keyboard, touch, tabs, and a collectible", async ({
  page,
}, testInfo) => {
  const actions: { action: string; points: number; workers: number }[] = [];
  await page.goto("/examples/gallery/index.html");
  const tree = page.locator("#tree-view");
  const panels = page.locator("#panel-view");
  await expect(tree.getByText("Points: 12")).toBeVisible();
  await expect(panels.getByText("Points: 12")).toBeVisible();
  await expect(panels.getByText("Undiscovered")).toHaveCount(0);

  await panels.getByRole("button", { name: "Make" }).tap();
  actions.push({ action: "touch-make", ...(await snapshot(page)) });
  await expect(tree.getByText("Points: 13")).toBeVisible();

  await page.keyboard.press("m");
  actions.push({ action: "hotkey-make", ...(await snapshot(page)) });
  await expect(panels.getByText("Points: 14")).toBeVisible();

  await tree.getByRole("button", { name: "★" }).click({ force: true });
  actions.push({ action: "claim-star", ...(await snapshot(page)) });
  await expect(panels.getByText("Star claimed once")).toBeVisible();
  await expect(tree.getByRole("button", { name: "★" })).toHaveCount(0);

  await panels.getByRole("tab", { name: "Grid" }).click();
  await panels.getByRole("button", { name: "Hire worker" }).click();
  actions.push({ action: "grid-hire", ...(await snapshot(page)) });
  await expect(tree.getByText("Points: 29")).toBeVisible();
  await expect(panels.getByText("Workers: 2")).toBeVisible();

  await panels.getByRole("tab", { name: "Work" }).click();
  const name = panels.getByRole("textbox", { name: "Name" });
  await name.fill("Foundry");
  await expect(name).toHaveValue("Foundry");
  await panels.getByRole("button", { name: "Make" }).focus();
  await panels.getByRole("button", { name: "Make" }).click();
  await expect(panels.getByRole("button", { name: "Make" })).toBeFocused();

  await testInfo.attach("interaction-trace", {
    body: JSON.stringify(actions, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("gallery", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("reduced motion disables visual transitions without changing state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/examples/gallery/index.html");
  await expect(page.locator(".e308-progress-fill").first()).toHaveAttribute(
    "data-animated",
    "false",
  );
  await expect(page.locator("#tree-view .e308-particles")).toHaveAttribute(
    "data-reduced-motion",
    "true",
  );
  expect(await snapshot(page)).toEqual({ points: 12, workers: 1 });
});

async function snapshot(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const state = (
      window as unknown as { e308Gallery: { snapshot(): { points: number; workers: number } } }
    ).e308Gallery.snapshot();
    return { points: state.points, workers: state.workers };
  });
}
