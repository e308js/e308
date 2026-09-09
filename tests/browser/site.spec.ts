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
  await expect(page.getByRole("heading", { name: "Three original games" })).toBeVisible();
  for (const name of ["Wireworks", "Cascade", "Hearth"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "Open Wireworks" }).click();
  await expect(page.locator("#game")).toHaveClass(/wireworks/);
  await expect(page.locator("#host-status")).toContainText("wireworks");
  await page.getByRole("button", { name: "New save" }).click();
  await expect(page.locator("#host-status")).toHaveText("Started a new save");
  await expect(page.getByRole("button", { name: "Make one clip by hand" })).toBeEnabled();
  await page.getByRole("button", { name: "Make one clip by hand" }).click();
  await expect(page.getByText("Clip inventory: 1", { exact: true })).toBeVisible();
  for (let made = 1; made < 5; made += 1) {
    await page.getByRole("button", { name: "Make one clip by hand" }).click();
  }
  const premiumSale = page.getByRole("button", { name: "Sell 5 clips — premium" });
  await expect(premiumSale).toBeEnabled();
  await premiumSale.click();
  await expect(page.locator("#host-status")).toHaveText("Action applied");
  await expect(page.getByText("Cash: 80", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Buy 200 feedstock" }).click();
  await expect(page.getByText("Cash: 70", { exact: true })).toBeVisible();
  expect(
    await page
      .getByRole("button", { name: "Buy 200 feedstock" })
      .evaluate((button) => getComputedStyle(button).marginRight),
  ).not.toBe("0px");
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
  const miner = page.getByLabel("miner");
  await expect(miner).toHaveAttribute("min", "0");
  await expect(miner).toHaveAttribute("max", "4");
  await expect(miner).toHaveAttribute("data-allowed-max", "1");
  await expect(miner.locator("xpath=../datalist/option")).toHaveCount(5);
  await miner.scrollIntoViewIfNeeded();
  await miner.evaluate(
    (input) => ((input as HTMLInputElement & { marker?: string }).marker = "drag"),
  );
  const track = await miner.boundingBox();
  if (!track) throw new Error("expected the miner range track");
  await page.mouse.move(track.x + 2, track.y + track.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width - 2, track.y + track.height / 2, { steps: 8 });
  await page.waitForTimeout(1_250);
  expect(
    await miner.evaluate((input) => (input as HTMLInputElement & { marker?: string }).marker),
  ).toBe("drag");
  await page.mouse.up();
  await expect(page.getByText("0 of 4 workers available.", { exact: false })).toBeVisible();
  await expect(miner).toHaveValue("1");
  await expect(miner.locator("xpath=../output")).toHaveText("1 of 4");
  await expect(page.getByLabel("scholar")).toHaveAttribute("max", "4");
  await expect(page.getByLabel("scholar")).toHaveAttribute("data-allowed-max", "0");
  await page.getByRole("tab", { name: "Crafting" }).click();
  await expect(page.getByRole("button", { name: "build cottage" })).toBeVisible();
  await expect(page.getByText("A cottage adds one worker")).toBeVisible();
  await page.getByRole("tab", { name: "Projects" }).click();
  await expect(page.getByRole("button", { name: "raise great hall" })).toBeDisabled();
  await expect(page.getByText("wood: need 30, have", { exact: false })).toBeVisible();

  await page.goto("/site-dist/examples/cascade/");
  await expect(page.locator("#host-status")).toContainText("cascade");
  await page.getByRole("button", { name: "New save" }).click();
  await expect(page.locator("#host-status")).toHaveText("Started a new save");
  await expect(page.getByRole("button", { name: "Buy Tier 1 generator" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Advance one minute" })).toBeHidden();
  await page.getByRole("button", { name: "Buy Tier 1 generator" }).click();
  await expect(page.getByText("Tier 1 generators: 1", { exact: true })).toBeVisible();
  const advance = page.getByRole("button", { name: "Advance one minute" });
  await page.getByText("Developer tools", { exact: true }).click();
  await expect(advance).toBeVisible();
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
