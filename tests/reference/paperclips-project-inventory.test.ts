import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allPaperclipsProjects,
  paperclipsProjectSourceMap,
} from "../../reference/paperclips/full/index.js";

interface SourceProject {
  readonly sourceVariable: string;
  readonly sourceId: string;
  readonly title: string;
  readonly priceTag: string | null;
  readonly description: string | null;
  readonly trigger: string | null;
  readonly cost: string | null;
  readonly effectWrites: readonly string[];
  readonly effectCalls: readonly string[];
}

interface SourceInventory {
  readonly schema: string;
  readonly schemaVersion: number;
  readonly source: string;
  readonly sourceSha256: string;
  readonly count: number;
  readonly projects: readonly SourceProject[];
}

const inventory = JSON.parse(inventorySource()) as SourceInventory;
const manifest = JSON.parse(
  readFileSync(new URL("../../reference/paperclips/manifest.json", import.meta.url), "utf8"),
) as {
  readonly sourceSha256: Readonly<Record<string, string>>;
  readonly projectInventory: { readonly count: number; readonly sha256: string };
};

describe("Universal Paperclips complete project inventory", () => {
  it("records every project object from the exact pinned source", () => {
    expect(inventory).toMatchObject({
      schema: "e308-paperclips-project-inventory",
      schemaVersion: 1,
      source: "projects.js?v3",
      count: 96,
    });
    expect(inventory.sourceSha256).toBe(manifest.sourceSha256["projects.js?v3"]);
    expect(inventory.count).toBe(manifest.projectInventory.count);
    expect(createHash("sha256").update(inventorySource()).digest("hex")).toBe(
      manifest.projectInventory.sha256,
    );
    expect(new Set(inventory.projects.map((project) => project.sourceVariable)).size).toBe(96);
    expect(new Set(inventory.projects.map((project) => project.sourceId)).size).toBe(96);
    expect(inventory.projects.every((project) => project.title.length > 0)).toBe(true);
    expect(inventory.projects.every((project) => project.effectWrites.length > 0)).toBe(true);
  });

  it("maps every campaign project to exactly one source object", () => {
    const sourceVariables = new Set(inventory.projects.map((project) => project.sourceVariable));
    const implementationIds = Object.values(paperclipsProjectSourceMap);
    expect(Object.keys(paperclipsProjectSourceMap)).toHaveLength(96);
    expect(Object.keys(paperclipsProjectSourceMap).every((id) => sourceVariables.has(id))).toBe(
      true,
    );
    expect(new Set(implementationIds).size).toBe(96);
    expect(new Set(implementationIds)).toEqual(
      new Set(allPaperclipsProjects.map((project) => project.id)),
    );
    expect(inventory.count - implementationIds.length).toBe(0);
  });

  it("captures dynamic, repeatable, story, prestige, and dismantling projects", () => {
    const variables = new Set(inventory.projects.map((project) => project.sourceVariable));
    expect([...variables]).toEqual(
      expect.arrayContaining([
        "project40b",
        "project51",
        "project133",
        "project140",
        "project147",
        "project200",
        "project210",
        "project217",
        "project219",
      ]),
    );
  });
});

function inventorySource(): string {
  return readFileSync(
    new URL("../../reference/paperclips/project-inventory.json", import.meta.url),
    "utf8",
  );
}
