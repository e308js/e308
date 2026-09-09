import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: coreAliases([
      "balance",
      "browser",
      "calendar",
      "markets",
      "offline",
      "persistence",
      "storage",
      "tasks",
      "testing",
      "worker",
    ]),
  },
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

function coreAliases(subpaths: readonly string[]) {
  return [
    ...subpaths.map((subpath) => ({
      find: `@e308/core/${subpath}`,
      replacement: fileURLToPath(
        new URL(`./packages/core/src/${subpath}/index.ts`, import.meta.url),
      ),
    })),
    {
      find: /^@e308\/core$/,
      replacement: fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
    },
  ];
}
