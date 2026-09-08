import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.d.ts", "**/*.types.ts", "**/dist/**", "**/index.ts"],
      include: ["packages/*/src/**/*.ts", "reference/**/*.ts", "tools/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        perFile: true,
        statements: 80,
      },
    },
    globals: true,
    include: ["tests/**/*.test.ts"],
    reporters: ["default"],
    restoreMocks: true,
  },
});
