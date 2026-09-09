import { readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface LeafIndex {
  readonly schema: string;
  readonly schemaVersion: number;
  readonly upstream: { readonly repository: string; readonly commit: string };
  readonly counts: {
    readonly total: number;
    readonly required: number;
    readonly aliases: number;
    readonly implementationMechanisms: number;
    readonly passed: number;
    readonly failed: number;
    readonly notRun: number;
  };
  readonly inheritedEvidence: { readonly groupEvidence: string };
  readonly documents: readonly {
    readonly source: string;
    readonly sha256: string;
    readonly file: string;
    readonly entries: number;
  }[];
}

interface Leaf {
  readonly id: string;
  readonly line: number;
  readonly key: string;
  readonly group: string;
  readonly disposition: "required" | "alias" | "implementation-mechanism";
  readonly status: "PASS" | "FAIL" | "NOT RUN";
}

interface GroupEvidence {
  readonly group: string;
  readonly publicSurface: string;
  readonly unitEvidence: string;
  readonly interactionEvidence: string;
  readonly comparison: string;
}

const evidenceRoot = new URL("../../docs/evidence/tmt/", import.meta.url);

describe("TMT leaf evidence inventory", () => {
  it("maps every pinned document entry to a unique resolved leaf", async () => {
    const index = await json<LeafIndex>(new URL("index.json", evidenceRoot));
    expect(index).toMatchObject({
      schema: "e308-tmt-leaf-index",
      schemaVersion: 1,
      upstream: {
        repository: "Acamaeda/The-Modding-Tree",
        commit: "4d8a86cfb3c59ef3ef4c222f21ef4fbee980c621",
      },
      counts: { total: 447, required: 366, failed: 0, notRun: 0 },
    });
    expect(index.documents.map((document) => document.source)).toEqual(requiredSources);

    const sourceHashes = await tmtSourceHashes();
    const leaves = (
      await Promise.all(
        index.documents.map(async (document) => {
          expect(document.sha256).toBe(sourceHashes.get(document.source));
          const entries = await jsonLines<Leaf>(new URL(document.file, evidenceRoot));
          expect(entries).toHaveLength(document.entries);
          return entries;
        }),
      )
    ).flat();
    expect(leaves).toHaveLength(index.counts.total);
    expect(new Set(leaves.map((leaf) => leaf.id)).size).toBe(leaves.length);
    expect(leaves.every(validLeaf)).toBe(true);
    expect(count(leaves, "required")).toBe(index.counts.required);
    expect(count(leaves, "alias")).toBe(index.counts.aliases);
    expect(count(leaves, "implementation-mechanism")).toBe(index.counts.implementationMechanisms);
  });

  it("covers all 37 groups with existing unit and interaction evidence", async () => {
    const index = await json<LeafIndex>(new URL("index.json", evidenceRoot));
    const groups = await jsonLines<GroupEvidence>(
      new URL(index.inheritedEvidence.groupEvidence, evidenceRoot),
    );
    const expected = Array.from(
      { length: 37 },
      (_, index) => `T${String(index + 1).padStart(2, "0")}`,
    );
    expect(groups.map((group) => group.group)).toEqual(expected);
    for (const group of groups) {
      expect(group.publicSurface.length).toBeGreaterThan(4);
      expect(group.comparison.length).toBeGreaterThan(4);
      await expect(
        stat(new URL(`../../${group.unitEvidence}`, import.meta.url)),
      ).resolves.toMatchObject({
        size: expect.any(Number),
      });
      await expect(
        stat(new URL(`../../${group.interactionEvidence}`, import.meta.url)),
      ).resolves.toMatchObject({ size: expect.any(Number) });
    }
  });
});

const requiredSources = [
  "docs/!general-info.md",
  "docs/achievements.md",
  "docs/bars.md",
  "docs/basic-layer-breakdown.md",
  "docs/buyables.md",
  "docs/challenges.md",
  "docs/clickables.md",
  "docs/custom-tab-layouts.md",
  "docs/grids.md",
  "docs/infoboxes.md",
  "docs/layer-features.md",
  "docs/main-mod-info.md",
  "docs/milestones.md",
  "docs/other.md",
  "docs/particles.md",
  "docs/subtabs-and-microtabs.md",
  "docs/trees-and-tree-customization.md",
  "docs/upgrades.md",
  "docs/tutorials/getting-started.md",
  "docs/tutorials/making-a-mod.md",
  "docs/tutorials/updating-tmt.md",
  "js/components.js",
  "js/game.js",
  "js/mod.js",
  "js/technical/temp.js",
  "js/utils.js",
  "js/utils/options.js",
  "js/utils/save.js",
] as const;

function validLeaf(leaf: Leaf): boolean {
  return (
    /^T\d{2}\./.test(leaf.id) &&
    /^T(?:0[1-9]|[12]\d|3[0-7])$/.test(leaf.group) &&
    Number.isSafeInteger(leaf.line) &&
    leaf.line > 0 &&
    leaf.key.length > 0 &&
    ["required", "alias", "implementation-mechanism"].includes(leaf.disposition) &&
    leaf.status === "PASS"
  );
}

function count(leaves: readonly Leaf[], disposition: Leaf["disposition"]): number {
  return leaves.filter((leaf) => leaf.disposition === disposition).length;
}

async function json<T>(url: URL): Promise<T> {
  return JSON.parse(await readFile(url, "utf8")) as T;
}

async function jsonLines<T>(url: URL): Promise<T[]> {
  return (await readFile(url, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as T);
}

async function tmtSourceHashes(): Promise<Map<string, string>> {
  const manifest = await json<{
    readonly repositories: readonly {
      readonly repo: string;
      readonly inspectedFiles: readonly { readonly path: string; readonly sha256: string }[];
    }[];
  }>(new URL("../../docs/source-manifest.json", import.meta.url));
  const repository = manifest.repositories.find(
    (candidate) => candidate.repo === "Acamaeda/The-Modding-Tree",
  );
  if (!repository) throw new TypeError("Pinned TMT repository is absent");
  return new Map(repository.inspectedFiles.map((file) => [file.path, file.sha256]));
}
