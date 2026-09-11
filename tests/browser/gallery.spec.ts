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

  const repeat = panels.getByRole("checkbox", { name: "Repeat" });
  await expect(repeat).toBeChecked();
  await panels.getByText("Repeat", { exact: true }).tap();
  await expect(repeat).not.toBeChecked();
  await repeat.tap();
  await expect(repeat).toBeChecked();

  const help = panels.getByRole("button", { name: "About Metal rate" });
  await help.tap();
  await expect(panels.getByText(/1 point per second/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panels.getByText(/1 point per second/)).not.toBeVisible();
  await expect(help).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panels.getByText(/1 point per second/)).toBeVisible();
  await page.keyboard.press("Escape");
  await help.click();
  await expect(panels.getByText(/1 point per second/)).toBeVisible();
  await page.keyboard.press("Escape");

  const workTab = panels.getByRole("tab", { name: "Work" });
  await workTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(panels.getByRole("tab", { name: "Grid" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(workTab).toHaveAttribute("aria-selected", "true");

  const blocked = panels.getByRole("button", { name: "Calibrate forge" });
  await expect(blocked).toHaveAttribute("aria-disabled", "true");
  await blocked.focus();
  await expect(blocked).toBeFocused();
  await expect(blocked.getByRole("listitem")).toHaveCount(2);
  await expect(blocked).toContainText("requires precision-tools, forge-level-2");
  await expect(blocked).toContainText("points: need 50, have 12");
  await expect(panels.getByRole("status", { name: "" }).first()).toBeVisible();
  await expect(panels.getByRole("button", { name: "Syncing command" })).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(panels.getByRole("button", { name: "Completed command" })).toHaveAttribute(
    "data-state",
    "successful",
  );
  const risky = panels.getByRole("button", { name: "Submit risky command" });
  await expect(risky).toHaveAttribute("data-state", "available");
  await risky.click();
  await expect(risky).toHaveAttribute("data-state", "rejected");
  const rejection = panels.getByRole("alert");
  await expect(rejection).toContainText("server rejected");
  expect(await rejection.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");
  await expect(panels).toHaveScreenshot("gallery-panel-desktop.png", {
    animations: "disabled",
  });

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

test("mobile baseline keeps the toggle attached, touch targets usable, and content overflow-free", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/examples/gallery/index.html");
  const panels = page.locator("#panel-view");
  const repeat = panels.getByRole("checkbox", { name: "Repeat" });
  const label = panels.locator("label.e308-toggle");
  await expect(repeat).toBeVisible();
  await expect(label).toContainText("Repeat");

  const geometry = await label.evaluate((element) => {
    const control = element.querySelector("input");
    if (!control) throw new Error("missing toggle control");
    const target = element.getBoundingClientRect();
    const checkbox = control.getBoundingClientRect();
    return {
      targetHeight: target.height,
      checkboxHeight: checkbox.height,
      gap: Math.max(0, checkbox.left - target.right, target.left - checkbox.right),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(geometry.targetHeight).toBeGreaterThanOrEqual(44);
  expect(geometry.checkboxHeight).toBeLessThan(44);
  expect(geometry.gap).toBe(0);
  expect(geometry.overflow).toBeLessThanOrEqual(0);

  await label.tap();
  await expect(repeat).not.toBeChecked();
  await expect(panels).toHaveScreenshot("gallery-panel-mobile.png", {
    animations: "disabled",
  });
  await testInfo.attach("gallery-mobile", {
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
