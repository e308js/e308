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

  it("pins the Kittens and Paperclips S05 sources", () => {
    const kittens = JSON.parse(
      readFileSync(new URL("../../reference/kittens/manifest.json", import.meta.url), "utf8"),
    ) as { commit: string; sourceSha256: Record<string, string> };
    expect(kittens.commit).toBe("781e379f79f1e7512d168849cba21ed111502644");
    expect(Object.keys(kittens.sourceSha256)).toHaveLength(7);
    const paperclips = JSON.parse(
      readFileSync(new URL("../../reference/paperclips/manifest.json", import.meta.url), "utf8"),
    ) as { sourceSha256: Record<string, string>; mapping: Record<string, string> };
    expect(Object.keys(paperclips.sourceSha256)).toHaveLength(4);
    expect(Object.keys(paperclips.mapping)).toEqual(["PC01", "PC02", "PC03"]);
    for (const hash of [
      ...Object.values(kittens.sourceSha256),
      ...Object.values(paperclips.sourceSha256),
    ])
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("pins the Array Game v0.4.2 browser sources", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../reference/array/manifest.json", import.meta.url), "utf8"),
    ) as {
      reference: string;
      sourceSha256: Record<string, string>;
      currentSlice: { open: string[] };
    };
    expect(manifest.reference).toBe("Array Game v0.4.2");
    expect(Object.keys(manifest.sourceSha256)).toEqual([
      "index.html",
      "constantsv042.js",
      "script.js?v0421=1",
      "changelog.txt",
    ]);
    for (const hash of Object.values(manifest.sourceSha256)) expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.currentSlice.open).toEqual([]);
  });
});
