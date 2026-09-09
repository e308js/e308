import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Transaction } from "@e308/core";
import { describe, expect, it } from "vitest";
import {
  autoClipperCurve,
  createPaperclipsReference,
  megaClipperCurve,
  paperclipsBuyables,
  paperclipsResources,
} from "../../reference/paperclips/full/index.js";

interface GoldenTrace {
  readonly sources: Readonly<Record<string, string>>;
  readonly scenarios: {
    readonly initial: Readonly<Record<string, number>>;
    readonly retail: {
      readonly afterManual: Readonly<Record<string, number>>;
      readonly afterPrice: Readonly<Record<string, number>>;
    };
    readonly machineCosts: {
      readonly autoClippers: readonly Readonly<Record<string, number>>[];
      readonly megaClippers: readonly Readonly<Record<string, number>>[];
      readonly marketing: readonly Readonly<Record<string, number>>[];
    };
    readonly autoClipperProjects: readonly Readonly<Record<string, number>>[];
    readonly wireProjects: readonly Readonly<Record<string, number>>[];
  };
}

const goldenSource = readFileSync(
  new URL("../../reference/paperclips/golden-trace.json", import.meta.url),
  "utf8",
);
const golden = JSON.parse(goldenSource) as GoldenTrace;
const manifest = JSON.parse(
  readFileSync(new URL("../../reference/paperclips/manifest.json", import.meta.url), "utf8"),
) as {
  readonly sourceSha256: Readonly<Record<string, string>>;
  readonly goldenTrace: { readonly sha256: string; readonly scenarios: readonly string[] };
};

describe("Universal Paperclips pinned-source golden trace", () => {
  it("is generated from the four pinned scripts and protected by the manifest", () => {
    expect(golden.sources).toEqual({
      "combat.js": manifest.sourceSha256["combat.js?v3"],
      "globals.js": manifest.sourceSha256["globals.js?v3"],
      "main.js": manifest.sourceSha256["main.js?v3"],
      "projects.js": manifest.sourceSha256["projects.js?v3"],
    });
    expect(Object.keys(golden.scenarios)).toEqual(manifest.goldenTrace.scenarios);
    expect(createHash("sha256").update(goldenSource).digest("hex")).toBe(
      manifest.goldenTrace.sha256,
    );
  });

  it("matches canonical initial retail and compute state", () => {
    const snapshot = createPaperclipsReference().getSnapshot();
    expect(snapshot.resources).toMatchObject({
      clips: golden.scenarios.initial.clips,
      "unsold-clips": golden.scenarios.initial.unsoldClips,
      funds: golden.scenarios.initial.funds,
      "clip-price": golden.scenarios.initial.margin,
      wire: golden.scenarios.initial.wire,
      "wire-cost": golden.scenarios.initial.wireCost,
      "wire-supply": golden.scenarios.initial.wireSupply,
      "marketing-level": golden.scenarios.initial.marketingLvl,
      operations: golden.scenarios.initial.operations,
      trust: golden.scenarios.initial.trust,
    });
    expect(snapshot.allocations.compute).toEqual({
      processors: golden.scenarios.initial.processors,
      memory: golden.scenarios.initial.memory,
    });
  });

  it("matches manual production and the source price-control checkpoint", () => {
    const game = createPaperclipsReference();
    for (let index = 0; index < 10; index += 1) {
      expect(game.dispatch({ type: "make-clip" })).toMatchObject({ ok: true });
    }
    expect(game.getSnapshot().resources).toMatchObject({
      clips: golden.scenarios.retail.afterManual.clips,
      "unsold-clips": golden.scenarios.retail.afterManual.unsoldClips,
      wire: golden.scenarios.retail.afterManual.wire,
    });
    const sourcePrice = golden.scenarios.retail.afterPrice.margin as number;
    expect(game.dispatch({ type: "set-price", price: sourcePrice })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources[paperclipsResources.price.id]).toBe(sourcePrice);
  });

  it("matches the source's discontinuous machine purchase curves", () => {
    const auto = golden.scenarios.machineCosts.autoClippers;
    const mega = golden.scenarios.machineCosts.megaClippers;
    expect(autoClipperCurve.unitCost(0)).toBe(golden.scenarios.initial.clipperCost);
    expect(megaClipperCurve.unitCost(0)).toBe(golden.scenarios.initial.megaClipperCost);
    for (let count = 1; count <= 3; count += 1) {
      expect(autoClipperCurve.unitCost(count)).toBeCloseTo(auto[count - 1]?.clipperCost as number);
      expect(megaClipperCurve.unitCost(count)).toBeCloseTo(
        mega[count - 1]?.megaClipperCost as number,
      );
    }
    expect(autoClipperCurve.totalCost(0, 3)).toBeCloseTo(20_000 - (auto[2]?.funds as number));
    expect(megaClipperCurve.totalCost(0, 3)).toBeCloseTo(20_000 - (mega[2]?.funds as number));
    expect(autoClipperCurve.maxAffordable(17.31, 0)).toBe(3);
    expect(megaClipperCurve.maxAffordable(2_714.9, 0)).toBe(3);
    expect(autoClipperCurve.maxAffordable(1_000, 0, 2)).toBe(2);
    expect(() => autoClipperCurve.maxAffordable(-1, 0)).toThrow("balance");
    expect(() => autoClipperCurve.unitCost(-1)).toThrow("count");
  });

  it("charges the source prices through ordinary e308 purchase commands", () => {
    const game = createPaperclipsReference();
    seed(game, (transaction) => {
      transaction.set(paperclipsResources.funds, 20_000);
      transaction.setProgress("upgrade", "mega-clippers");
    });
    for (let count = 1; count <= 3; count += 1) {
      expect(game.dispatch({ type: "buy", id: "auto-clipper" })).toMatchObject({ ok: true });
      expect(game.getSnapshot().purchaseCounts[paperclipsBuyables.autoClipper.id]).toBe(count);
    }
    expect(game.getSnapshot().resources.funds).toBeCloseTo(
      golden.scenarios.machineCosts.autoClippers[2]?.funds as number,
    );
  });

  it("matches additive AutoClipper boosts and source wire-supply mutations", () => {
    const boostGame = createPaperclipsReference();
    seed(boostGame, (transaction) => {
      transaction.set(paperclipsResources.wire, 100);
      transaction.setPurchase(paperclipsBuyables.autoClipper.id, 1);
      for (const id of [
        "improved-auto-clippers",
        "even-better-auto-clippers",
        "optimized-auto-clippers",
      ]) {
        transaction.setProgress("upgrade", id);
      }
    });
    boostGame.advance(1_000);
    expect(boostGame.getSnapshot().resources.clips).toBe(
      golden.scenarios.autoClipperProjects[2]?.clipperBoost,
    );

    const wireGame = createPaperclipsReference();
    seed(wireGame, (transaction) => transaction.set(paperclipsResources.operations, 50_000));
    for (const [index, id] of [
      "improved-wire-extrusion",
      "optimized-wire-extrusion",
      "microlattice-shapecasting",
    ].entries()) {
      expect(wireGame.dispatch({ type: "project", id })).toMatchObject({ ok: true });
      expect(wireGame.getSnapshot().resources[paperclipsResources.wireSupply.id]).toBe(
        golden.scenarios.wireProjects[index]?.wireSupply,
      );
    }
  });
});

function seed(
  reference: ReturnType<typeof createPaperclipsReference>,
  apply: (transaction: Transaction<number>) => void,
): void {
  reference.game.dispatch({ id: "golden-seed", execute: apply });
}
