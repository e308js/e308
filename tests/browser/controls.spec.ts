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
