import { expect, test } from "@playwright/test";

test("select names stay label-only across options, rerenders, and separate mounts", async ({
  page,
}) => {
  await page.goto("/tests/browser/fixtures/controls.html");
  const first = page.locator("#first");
  const second = page.locator("#second");
  const select = first.getByRole("combobox", { name: "Play mode", exact: true });
  await expect(select).toHaveAccessibleName("Play mode");
  await expect(first.getByLabel("Play mode", { exact: true })).toHaveAttribute("id", "custom-mode");
  await select.selectOption("online");
  await expect(select).toHaveValue("online");
  await expect(second.getByRole("combobox", { name: "Play mode", exact: true })).toHaveValue(
    "online",
  );
  await expect(select).toHaveAccessibleName("Play mode");
  await first.getByText("Play mode", { exact: true }).click();
  await expect(select).toBeFocused();
  await select.selectOption("practice");
  await expect(first.getByLabel("Play mode", { exact: true })).toHaveValue("practice");
  const labels = await page
    .locator(".e308-input-label")
    .evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(labels).size).toBe(2);
});

async function refresh(page: import("@playwright/test").Page) {
  await page.evaluate(() => (window as unknown as { refreshControls(): void }).refreshControls());
}

test("mouse preview stays hoverable, survives live renders, pins on click, and dismisses", async ({
  page,
}) => {
  await page.goto("/tests/browser/fixtures/controls.html");
  const help = page.locator("#first .e308-help");
  const trigger = help.getByRole("button", { name: "About play mode" });
  const content = help.locator(".e308-help-content");
  await trigger.hover();
  await expect(content).toBeVisible();
  await refresh(page);
  await expect(content).toBeVisible();
  await content.hover();
  await expect(content).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(content).not.toBeVisible();
  await trigger.hover();
  await page.keyboard.press("Escape");
  await expect(content).not.toBeVisible();
  await page.mouse.move(0, 0);
  await trigger.hover();
  await trigger.click();
  await page.mouse.move(0, 0);
  await refresh(page);
  await expect(content).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(content).not.toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await refresh(page);
  await expect(content).not.toBeVisible();
});

test("keyboard preview supports focus inside, Escape, reopening, and pinning", async ({ page }) => {
  await page.goto("/tests/browser/fixtures/controls.html");
  const help = page.locator("#first .e308-help");
  const trigger = help.getByRole("button", { name: "About play mode" });
  const content = help.locator(".e308-help-content");
  await page.keyboard.press("Tab");
  await expect(trigger).toBeFocused();
  await expect(content).toBeVisible();
  await refresh(page);
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(help.getByRole("link")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(content).not.toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(content).toBeVisible();
  await page.keyboard.press("Enter");
  await page.locator("#first select").focus();
  await expect(content).toBeVisible();
  await trigger.focus();
  await page.keyboard.press("Space");
  await expect(content).not.toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(content).toBeVisible();
  await page.locator("#first select").focus();
  await expect(content).not.toBeVisible();
});

test("touch activation pins previews and default help still requires activation", async ({
  page,
}) => {
  await page.goto("/tests/browser/fixtures/controls.html");
  for (const id of ["first", "second"]) {
    const help = page.locator(`#${id} .e308-help`);
    const trigger = help.getByRole("button", { name: "About play mode" });
    const content = help.locator(".e308-help-content");
    if (id === "second") {
      await trigger.hover();
      await trigger.focus();
      await expect(content).not.toBeVisible();
    }
    await trigger.tap();
    await expect(content).toBeVisible();
    await refresh(page);
    await expect(content).toBeVisible();
    await trigger.tap();
    await expect(content).not.toBeVisible();
  }
});

for (const width of [320, 390, 768, 1440]) {
  test(`help stays in the viewport at ${width}px without covering focus`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 650 });
    await page.goto("/tests/browser/fixtures/controls.html");
    const help = page.locator("#first .e308-help");
    const trigger = help.getByRole("button", { name: "About play mode" });
    await page.addStyleTag({
      content: "#first .e308-help { position: fixed; right: 12px; bottom: 12px; }",
    });
    await trigger.tap();
    const content = help.locator(".e308-help-content");
    await expect(content).toBeVisible();
    await refresh(page);
    const bounds = await content.boundingBox();
    const button = await trigger.boundingBox();
    if (!bounds || !button) throw new Error("missing help geometry");
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(button.y);
    await page.locator("#first select").focus();
    const focused = await page.locator("#first select").boundingBox();
    const repositioned = await content.boundingBox();
    if (!focused || !repositioned) throw new Error("missing focused geometry");
    expect(
      repositioned.y + repositioned.height <= focused.y ||
        repositioned.y >= focused.y + focused.height,
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(button.height).toBeGreaterThanOrEqual(44);
    await testInfo.attach(`help-${width}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
}

test("long help scrolls, repositions on resize and scroll, and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/browser/fixtures/controls.html?long");
  await page.addStyleTag({
    content: "body { min-height: 200vh; } #first .e308-help { margin-top: 100px; }",
  });
  const help = page.locator("#first .e308-help");
  const trigger = help.getByRole("button", { name: "About play mode" });
  const content = help.locator(".e308-help-content");
  await trigger.tap();
  await page.setViewportSize({ width: 320, height: 480 });
  await page.evaluate(() => window.scrollTo(0, 100));
  await expect
    .poll(async () =>
      content.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight
        );
      }),
    )
    .toBe(true);
  expect(await content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  );
  await help.getByRole("link").focus();
  await expect(help.getByRole("link")).toBeInViewport();
  await refresh(page);
  await expect(content).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(content).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
