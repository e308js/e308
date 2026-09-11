import { expect, type Page } from "@playwright/test";

/** Golden images must not depend on the runner's system-ui font selection. */
export async function prepareGalleryFonts(page: Page): Promise<void> {
  await page.addStyleTag({ url: "/tests/browser/fonts/gallery.css" });
  const loaded = await page.evaluate(async () => {
    const faces = await Promise.all([
      document.fonts.load('400 16px "Gallery Noto Sans"'),
      document.fonts.load('700 16px "Gallery Noto Sans"'),
    ]);
    await document.fonts.ready;
    return faces.map((weights) => weights.length);
  });
  expect(loaded, "both bundled gallery font weights must load without fallback").toEqual([1, 1]);
}
