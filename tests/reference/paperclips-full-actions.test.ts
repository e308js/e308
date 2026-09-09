import type { Transaction } from "@e308/core";
import { describe, expect, it } from "vitest";
import {
  createPaperclipsReference,
  paperclipsBuyables,
  paperclipsResources,
} from "../../reference/paperclips/full/index.js";
import { paperclipsFullQuotes } from "../../reference/paperclips/full/scenario-quotes.js";

describe("Universal Paperclips campaign action boundaries", () => {
  it("enforces phase and project prerequisites", () => {
    const game = createPaperclipsReference();
    expect(game.dispatch({ type: "project", id: "improved-auto-clippers" })).toMatchObject({
      ok: false,
      error: { code: "insufficient", resourceId: "operations" },
    });
    expect(game.dispatch({ type: "project", id: "missing" })).toMatchObject({
      ok: false,
      error: { code: "invalid-target" },
    });
    expect(game.dispatch({ type: "project", id: "catchy-jingle" })).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    expect(game.dispatch({ type: "buy", id: "mega-clipper" })).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    expect(game.dispatch({ type: "buy", id: "factory" })).toMatchObject({
      ok: false,
      error: { code: "disabled" },
    });
    seed(game, (transaction) => transaction.setProgress("milestone", "industry-phase"));
    expect(game.dispatch({ type: "make-clip" })).toMatchObject({
      ok: false,
      error: { code: "disabled" },
    });
    expect(game.dispatch({ type: "project", id: "improved-auto-clippers" })).toMatchObject({
      ok: false,
      error: { code: "disabled" },
    });
  });

  it("applies pricing, marketing, wire extrusion, and project effects", () => {
    const game = createPaperclipsReference();
    expect(game.dispatch({ type: "buy-wire" })).toMatchObject({
      ok: false,
      error: { code: "insufficient" },
    });
    seed(game, (transaction) => {
      transaction.set(paperclipsResources.funds, 100_000);
      transaction.set(paperclipsResources.operations, 100_000);
      transaction.set(paperclipsResources.creativity, 100_000);
      transaction.set(paperclipsResources.trust, 10);
    });
    expect(game.dispatch({ type: "set-price", price: 0.5 })).toMatchObject({ ok: true });
    expect(game.dispatch({ type: "set-price", price: 101 })).toMatchObject({
      ok: false,
      error: { code: "invalid-count" },
    });
    expect(game.dispatch({ type: "buy", id: "marketing" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources[paperclipsResources.marketingLevel.id]).toBe(2);
    expect(game.dispatch({ type: "project", id: "lexical-processing" })).toMatchObject({
      ok: true,
    });
    expect(game.dispatch({ type: "project", id: "new-slogan" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources[paperclipsResources.marketingEffectiveness.id]).toBe(1.5);
    seed(game, (transaction) => {
      transaction.set(paperclipsResources.funds, 0);
      transaction.set(paperclipsResources.bankroll, 0);
      transaction.set(paperclipsResources.wire, 0);
      transaction.set(paperclipsResources.unsold, 0);
    });
    expect(game.dispatch({ type: "project", id: "beg-for-more-wire" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources.wire).toBe(1_000);
    seed(game, (transaction) => transaction.set(paperclipsResources.funds, 100_000));
    expect(game.dispatch({ type: "project", id: "improved-wire-extrusion" })).toMatchObject({
      ok: true,
    });
    seed(game, (transaction) => transaction.set(paperclipsResources.wire, 0));
    expect(game.dispatch({ type: "buy-wire" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources.wire).toBe(1_500);
  });

  it("runs each tournament family and moves funds through investments", () => {
    const game = createPaperclipsReference();
    seed(game, (transaction) => {
      transaction.setProgress("upgrade", "strategic-modeling");
      transaction.setProgress("upgrade", "algorithmic-trading");
      transaction.set(paperclipsResources.operations, 20_000);
      transaction.set(paperclipsResources.funds, 1_000);
    });
    expect(game.dispatch({ type: "tournament", strategy: "minimax" })).toMatchObject({
      ok: false,
      error: { code: "locked", prerequisiteIds: ["strategy-minimax"] },
    });
    seed(game, (transaction) => {
      for (const id of [
        "strategy-a100",
        "strategy-b100",
        "strategy-greedy",
        "strategy-generous",
        "strategy-minimax",
        "strategy-tit-for-tat",
        "strategy-beat-last",
      ]) {
        transaction.setProgress("upgrade", id);
      }
    });
    for (const strategy of ["minimax", "greedy", "a100", "random"] as const) {
      expect(game.dispatch({ type: "tournament", strategy })).toMatchObject({ ok: true });
    }
    expect(game.getSnapshot().resources.tournaments).toBe(4);
    expect(game.dispatch({ type: "invest", amount: -1 })).toMatchObject({
      ok: false,
      error: { code: "invalid-count" },
    });
    expect(game.dispatch({ type: "invest", amount: 500 })).toMatchObject({ ok: true });
    game.advance(60_000);
    expect(game.dispatch({ type: "withdraw" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources.bankroll).toBe(0);
  });

  it("spends source Trust even when all compute capacity is assigned", () => {
    const game = createPaperclipsReference();
    seed(game, (transaction) => {
      transaction.set(paperclipsResources.trust, 2);
      transaction.setAllocation("compute", "processors", 1);
      transaction.setAllocation("compute", "memory", 1);
      transaction.set(paperclipsResources.wire, 0);
    });
    expect(game.dispatch({ type: "project", id: "beg-for-more-wire" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources.trust).toBe(1);
    expect(game.dispatch({ type: "compute", target: "processor" })).toMatchObject({
      ok: false,
      error: { code: "insufficient" },
    });
    seed(game, (transaction) => {
      transaction.setProgress("milestone", "industry-phase");
      transaction.set(paperclipsResources.clips, 1e12);
    });
    expect(game.dispatch({ type: "buy", id: "harvester" })).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    seed(game, (transaction) => {
      transaction.setProgress("upgrade", "harvester-drones");
      transaction.setProgress("upgrade", "wire-drones");
      transaction.setProgress("upgrade", "clip-factories");
      transaction.setProgress("upgrade", "power-grid");
    });
    for (const id of ["harvester", "wire-drone", "factory", "solar-farm", "battery"] as const) {
      expect(game.dispatch({ type: "buy", id })).toMatchObject({ ok: true });
    }
    expect(game.getSnapshot().purchaseCounts[paperclipsBuyables.factory.id]).toBe(1);
  });

  it("stops the space simulation after either terminal choice", () => {
    for (const ending of ["accept-exile", "reject-exile"] as const) {
      const game = createPaperclipsReference();
      seed(game, (transaction) => {
        transaction.setProgress("milestone", "industry-phase");
        transaction.setProgress("milestone", "space-phase");
        transaction.setProgress("upgrade", ending);
        transaction.set(paperclipsResources.probes, 100);
      });
      const before = game.getSnapshot().resources.probes;
      game.advance(60_000);
      expect(game.getSnapshot().resources.probes).toBe(before);
      expect(paperclipsFullQuotes(game.getSnapshot())).toEqual([]);
    }
  });

  it("applies both source factory throughput upgrades", () => {
    const game = createPaperclipsReference();
    seed(game, (transaction) => {
      transaction.setProgress("milestone", "industry-phase");
      transaction.setProgress("upgrade", "upgraded-factories");
      transaction.setPurchase(paperclipsBuyables.factory.id, 1);
      transaction.setPurchase(paperclipsBuyables.battery.id, 1);
      transaction.set(paperclipsResources.processedMatter, 1e30);
      transaction.set(paperclipsResources.storedPower, 1e20);
    });
    const initial = game.getSnapshot().resources.clips as number;
    game.advance(1_000);
    expect((game.getSnapshot().resources.clips as number) - initial).toBeCloseTo(1e22);
    seed(game, (transaction) => transaction.setProgress("upgrade", "hyperspeed-factories"));
    const beforeHyperspeed = game.getSnapshot().resources.clips as number;
    game.advance(1_000);
    expect((game.getSnapshot().resources.clips as number) - beforeHyperspeed).toBeCloseTo(1e23);
  });

  it("spends swarm gifts on persistent compute and research after retail", () => {
    const game = createPaperclipsReference();
    seed(game, (transaction) => {
      transaction.setProgress("milestone", "industry-phase");
      transaction.setProgress("upgrade", "strategy-beat-last");
      transaction.set(paperclipsResources.creativity, 25_000);
      transaction.set(paperclipsResources.trust, 0);
      transaction.set(paperclipsResources.swarmGifts, 1);
    });
    expect(game.dispatch({ type: "compute", target: "memory" })).toMatchObject({ ok: true });
    expect(game.getSnapshot()).toMatchObject({
      resources: { "swarm-gifts": 0, "compute-capacity": 3 },
      allocations: { compute: { processors: 1, memory: 2 } },
    });
    expect(game.dispatch({ type: "project", id: "theory-of-mind" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources).toMatchObject({
      "tournament-cost": 16_000,
      "yomi-boost": 2,
    });
  });
});

function seed(
  reference: ReturnType<typeof createPaperclipsReference>,
  apply: (transaction: Transaction<number>) => void,
): void {
  reference.game.dispatch({ id: "test-seed", execute: apply });
}
