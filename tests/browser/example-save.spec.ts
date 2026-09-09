import { expect, test } from "@playwright/test";

test("starts a fresh example when its local save is unreadable", async ({ page }) => {
  const run = "invalid-local-save";
  await page.goto("/site-dist/");
  await page.evaluate(async (databaseName) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open(databaseName, 1);
      opening.onupgradeneeded = () =>
        opening.result.createObjectStore("saves", { keyPath: "slot" });
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("saves", "readwrite");
      transaction.objectStore("saves").put({ slot: "main", revision: "1", value: "bad save" });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, `e308-finished-wireworks-${run}`);

  await page.goto(`/site-dist/examples/wireworks/?run=${run}`);
  await expect(
    page.locator("#game").getByRole("heading", { name: "Wireworks", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Cash: 20", { exact: true })).toBeVisible();
  await expect(page.getByText("Feedstock: 240", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Make one clip by hand" })).toBeEnabled();
});
