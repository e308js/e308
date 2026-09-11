import { expect, test } from "@playwright/test";

test("native disclosure changes survive a same-task source update before toggle delivery", async ({
  page,
}) => {
  await page.goto("/examples/gallery/index.html");
  await expect(
    page.locator("#panel-view").getByRole("button", { name: "Make", exact: true }),
  ).toBeVisible();
  const states = await page.evaluate(() => {
    const details = document.querySelector<HTMLDetailsElement>(
      '#panel-view [data-e308-key="about"]',
    );
    const make = document.querySelector<HTMLButtonElement>(
      '#panel-view [data-e308-key="make-action"]',
    );
    if (!details || !make) throw new Error("missing gallery controls");
    details.open = true;
    make.click();
    const opened = details.open;
    details.open = false;
    make.click();
    return { opened, closed: !details.open };
  });
  expect(states).toEqual({ opened: true, closed: true });
  const about = page.locator('#panel-view [data-e308-key="about"]');
  await about.locator("summary").click();
  await page
    .locator("#panel-view")
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Foundry");
  await expect(about).toHaveAttribute("open", "");
});
