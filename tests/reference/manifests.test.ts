import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Manifest {
  readonly commit: string;
  readonly license: string;
  readonly files: readonly { readonly path: string; readonly sha256: string }[];
}

function load(relative: string): Manifest {
  return JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf8")) as Manifest;
}

describe("reference source manifests", () => {
  it.each([
    ["AD", "../../reference/ad/manifest.json", "5409e320cecef96a917cca1dfb68f1f183e499ca", 10],
    ["TMT", "../../reference/tmt/manifest.json", "4d8a86cfb3c59ef3ef4c222f21ef4fbee980c621", 2],
  ])("pins %s source files and license", (_, path, commit, fileCount) => {
    const manifest = load(path);
    expect(manifest).toMatchObject({ commit, license: "MIT" });
    expect(manifest.files).toHaveLength(fileCount);
    expect(new Set(manifest.files.map((file) => file.path)).size).toBe(fileCount);
    for (const file of manifest.files) expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
