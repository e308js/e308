import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    hasTouch: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    ...(process.env.CI ? {} : { launchOptions: { executablePath: "/usr/bin/google-chrome" } }),
  },
  webServer: {
    command: "node tests/browser/server.mjs",
    url: "http://127.0.0.1:4173/examples/gallery/index.html",
    reuseExistingServer: !process.env.CI,
  },
});
