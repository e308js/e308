import { expect, test } from "@playwright/test";

test("short trigger-only dwell and movement dismissal do not trap the pointer", async ({
  page,
}, info) => {
  const time = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.goto("/tests/browser/fixtures/controls.html?moving");
  await page.addStyleTag({ content: "#first .e308-help { width: 500px; }" });
  const help = page.locator("#first .e308-help");
  const trigger = help.getByRole("button", { name: "About play mode" });
  const content = help.locator(".e308-help-content");
  const box = await help.boundingBox();
  if (!box) throw new Error("missing wrapper");
  await page.mouse.move(box.x + box.width - 5, box.y + 10);
  await page.clock.runFor(200);
  await expect(content).toBeHidden();
  await trigger.hover();
  await page.clock.runFor(60);
  await expect(content).toBeHidden();
  await page.mouse.move(0, 0);
  await page.clock.runFor(200);
  await expect(content).toBeHidden();
  await trigger.hover();
  await page.clock.runFor(119);
  await expect(content).toBeHidden();
  await page.evaluate(() => (window as unknown as { refreshControls(): void }).refreshControls());
  await page.clock.runFor(1);
  await expect(content).toBeVisible();
  await expect(trigger.locator(".e308-help-arrow")).toBeVisible();
  const anchor = await trigger.boundingBox();
  const panel = await content.boundingBox();
  if (!anchor || !panel) throw new Error("missing preview geometry");
  await page.mouse.move(anchor.x + anchor.width / 2 + 3, anchor.y + anchor.height / 2);
  await expect(content).toBeVisible();
  await info.attach("short-help-preview", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  // This coordinate is INSIDE the popup, but far enough from the opening pointer position.
  await page.mouse.move(panel.x + panel.width / 2, panel.y + 10);
  await expect(content).toBeHidden();
  await page.clock.runFor(500);
  await page.evaluate(() => (window as unknown as { refreshControls(): void }).refreshControls());
  await expect(content).toBeHidden();
  await trigger.locator(".e308-help-arrow").click();
  await page.mouse.move(panel.x + panel.width / 2, panel.y + 10);
  await page.clock.runFor(500);
  await expect(content).toBeVisible();
  await expect(help).toHaveAttribute("data-help-pinned", "true");
  await page.keyboard.press("Escape");
  await expect(content).toBeHidden();
});
