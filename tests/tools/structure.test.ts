import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findSizeViolations,
  inspectStructure,
  isEntrypoint,
  lineLimit,
  runStructureCheck,
} from "../../tools/quality/structure.js";

describe("structure gate", () => {
  it("assigns stricter limits to barrels", () => {
    expect(lineLimit("/packages/core/src/index.ts")).toBe(80);
    expect(lineLimit("/packages/core/src/state.ts")).toBe(350);
    expect(lineLimit("/packages/core/src/state.test.ts")).toBe(500);
  });

  it("finds oversized first-party files", async () => {
    const root = await mkdtemp(join(tmpdir(), "e308-structure-"));
    await mkdir(join(root, "packages", "core", "src"), { recursive: true });
    await writeFile(join(root, "packages", "core", "src", "large.ts"), "x\n".repeat(351));
    await writeFile(join(root, "packages", "core", "src", "small.ts"), "x\n".repeat(10));

    await expect(findSizeViolations(root)).resolves.toEqual([
      { path: "packages/core/src/large.ts", actual: 352, limit: 350 },
    ]);
    await expect(runStructureCheck(root)).resolves.toBe(1);
  });

  it("accepts absent and conforming source roots", async () => {
    const root = await mkdtemp(join(tmpdir(), "e308-structure-empty-"));
    await mkdir(join(root, "packages", "core", "src", "dist"), { recursive: true });
    await writeFile(join(root, "packages", "core", "src", "empty.ts"), "");
    await writeFile(join(root, "packages", "core", "src", "notes.txt"), "ignored");
    await writeFile(join(root, "packages", "core", "src", "dist", "large.ts"), "x\n".repeat(400));
    await expect(runStructureCheck(root)).resolves.toBe(0);
  });

  it("recognizes only its direct command entrypoint", () => {
    expect(isEntrypoint("tools/quality/structure.ts")).toBe(true);
    expect(isEntrypoint("tests/tools/structure.test.ts")).toBe(false);
    expect(isEntrypoint(undefined)).toBe(false);
  });

  it("rejects large functions, copied blocks, and headless host imports", async () => {
    const root = await mkdtemp(join(tmpdir(), "e308-structure-rules-"));
    const source = join(root, "packages", "core", "src");
    await mkdir(source, { recursive: true });
    const repeated = Array.from({ length: 55 }, (_, index) => `value${index}`).join(" + ");
    const longBody = Array.from({ length: 81 }, () => "  total += 1;").join("\n");
    await writeFile(
      join(source, "first.ts"),
      `import fs from "node:fs";\nexport const copied = ${repeated};\nexport function tooLong() {\nlet total = 0;\n${longBody}\nreturn total;\n}`,
    );
    await writeFile(join(source, "second.ts"), `export const copiedAgain = ${repeated};`);

    const report = await inspectStructure(root);
    expect(report.functions).toEqual([
      { path: "packages/core/src/first.ts", actual: 85, limit: 80 },
    ]);
    expect(report.forbiddenImports).toEqual(["packages/core/src/first.ts: node:fs"]);
    expect(report.duplicateBlocks).toHaveLength(1);
    await expect(runStructureCheck(root)).resolves.toBe(1);
  });
});
