import { expect, test } from "@playwright/test";

test("two tabs enforce one writer, transfer ownership, and share IndexedDB saves", async ({
  context,
  page,
}, testInfo) => {
  await page.goto("/examples/browser-host/index.html");
  await expect(page.locator("#owner")).toHaveText("primary");
  const secondary = await context.newPage();
  await secondary.goto("/examples/browser-host/index.html");
  await expect(secondary.locator("#owner")).toHaveText("secondary");
  await expect(page.locator("#owner")).toHaveText("primary");
  const secondaryBefore = await numericText(secondary, "#points");
  expect(await invoke(secondary, "addPoint")).toBe(false);
  expect(await numericText(secondary, "#points")).toBe(secondaryBefore);

  expect(await invoke(page, "addPoint")).toBe(true);
  await expect(page.locator("#worker-result")).toHaveText("added");
  await expect.poll(() => numericText(page, "#points")).toBeGreaterThanOrEqual(secondaryBefore + 1);
  expect(await invoke(page, "save")).toBe(true);
  await expect
    .poll(() => numericText(secondary, "#points"))
    .toBeGreaterThanOrEqual(secondaryBefore + 1);
  const firstRevision = await page.locator("#storage").textContent();
  await expect(secondary.locator("#storage")).toHaveText(firstRevision ?? "missing");

  expect(await invoke(secondary, "takeOwnership")).toBe(true);
  await expect(secondary.locator("#owner")).toHaveText("primary");
  await expect(page.locator("#owner")).toHaveText("secondary");
  expect(await invoke(secondary, "addPoint")).toBe(true);
  expect(await invoke(secondary, "save")).toBe(true);
  await expect.poll(() => numericText(page, "#points")).toBeGreaterThanOrEqual(secondaryBefore + 2);

  await testInfo.attach("two-tab-trace", {
    body: JSON.stringify({
      firstRevision,
      finalRevision: await secondary.locator("#storage").textContent(),
      points: await numericText(secondary, "#points"),
    }),
    contentType: "application/json",
  });
});

test("browser worker matches a one-second host advancement and saves survive reload", async ({
  page,
}) => {
  await page.goto("/examples/browser-host/index.html");
  await expect(page.locator("#owner")).toHaveText("primary");
  expect(await invoke(page, "save")).toBe(true);
  const before = await numericText(page, "#points");
  await page.locator("#worker").click();
  await expect.poll(() => numericText(page, "#worker-result")).toBeGreaterThanOrEqual(before + 0.9);
  const revision = await page.locator("#storage").textContent();
  await page.reload();
  await expect(page.locator("#owner")).toHaveText("primary");
  await expect(page.locator("#storage")).not.toHaveText("none");
  expect(BigInt((await page.locator("#storage").textContent()) ?? "0")).toBeGreaterThanOrEqual(
    BigInt(revision ?? "0"),
  );
});

async function numericText(
  page: import("@playwright/test").Page,
  selector: string,
): Promise<number> {
  return Number(await page.locator(selector).textContent());
}

async function invoke(
  page: import("@playwright/test").Page,
  operation: "addPoint" | "save" | "takeOwnership",
): Promise<boolean> {
  return page.evaluate(async (name) => {
    const fixture = (
      window as unknown as {
        e308BrowserHost: Record<string, () => boolean | Promise<boolean>>;
      }
    ).e308BrowserHost;
    return fixture[name]?.() ?? false;
  }, operation);
}
