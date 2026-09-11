import { defineConfig } from "@playwright/test";

const port = Number(process.env.E308_TEST_PORT ?? 4173);

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    hasTouch: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/browser/server.mjs",
    url: `http://127.0.0.1:${port}/examples/gallery/index.html`,
    reuseExistingServer: !process.env.CI,
  },
});
