import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface ReferenceEvidence {
  readonly schema: string;
  readonly schemaVersion: number;
  readonly summary: {
    readonly required: number;
    readonly passed: number;
    readonly failed: number;
    readonly notRun: number;
  };
  readonly review: { readonly independentSourceReview: string };
  readonly cases: readonly ReferenceCase[];
}

interface ReferenceCase {
  readonly id: string;
  readonly sourceManifest: string;
  readonly test: string;
  readonly comparison: string;
  readonly interactive: string;
  readonly status: "PASS" | "FAIL" | "NOT RUN";
}

const root = new URL("../../", import.meta.url);

describe("reference-game release evidence", () => {
  it("maps every bounded parity case to pinned, executable, visible evidence", async () => {
    const evidence = JSON.parse(
      await readFile(new URL("docs/evidence/reference-games.json", root), "utf8"),
    ) as ReferenceEvidence;
    expect(evidence).toMatchObject({
      schema: "e308-reference-game-evidence",
      schemaVersion: 1,
      summary: { required: 15, passed: 15, failed: 0, notRun: 0 },
      review: { independentSourceReview: "pending" },
    });
    const expected = [
      ...Array.from({ length: 6 }, (_, index) => `AD0${index + 1}`),
      ...Array.from({ length: 6 }, (_, index) => `KG0${index + 1}`),
      ...Array.from({ length: 3 }, (_, index) => `PC0${index + 1}`),
    ];
    expect(evidence.cases.map(({ id }) => id)).toEqual(expected);
    for (const item of evidence.cases) {
      expect(item.status).toBe("PASS");
      expect(item.comparison.length).toBeGreaterThan(20);
      expect(item.interactive).toMatch(/^examples\/finished-games\//);
      const testSource = await readFile(new URL(item.test, root), "utf8");
      expect(testSource).toContain(item.id);
      const [interactivePath, fragment] = item.interactive.split("#");
      if (!interactivePath) throw new TypeError(`Missing interactive path for ${item.id}`);
      const interactiveSource = await readFile(new URL(interactivePath, root), "utf8");
      if (fragment) expect(interactiveSource).toContain(`id="${fragment}"`);
      await access(new URL(item.sourceManifest, root));
    }
  });
});
