import type { Transaction } from "@e308/core";
import { describe, expect, it } from "vitest";
import {
  createPaperclipsReference,
  paperclipsResources,
} from "../../reference/paperclips/full/index.js";
import { paperclipsFullQuotes } from "../../reference/paperclips/full/scenario-quotes.js";

describe("Universal Paperclips source ending projects", () => {
  it("applies repeatable Threnody costs and Memory release", () => {
    const game = spaceGame();
    seed(game, (transaction) => {
      transaction.setProgress("upgrade", "name-the-battles");
      transaction.set(paperclipsResources.creativity, 30_000);
      transaction.set(paperclipsResources.yomi, 12_000);
      transaction.set(paperclipsResources.computeCapacity, 12);
      transaction.setAllocation("compute", "processors", 2);
      transaction.setAllocation("compute", "memory", 10);
      transaction.set(paperclipsResources.probes, 0);
    });
    expect(game.dispatch({ type: "project", id: "threnody" })).toMatchObject({ ok: true });
    expect(game.dispatch({ type: "project", id: "threnody" })).toMatchObject({ ok: true });
    expect(game.getSnapshot().resources).toMatchObject({
      creativity: 0,
      yomi: 0,
      honor: 20_000,
      "threnody-cost": 30_000,
    });
    expect(game.dispatch({ type: "project", id: "memory-release" })).toMatchObject({ ok: true });
    expect(game.getSnapshot()).toMatchObject({
      resources: { clips: 1e22 },
      allocations: { compute: { processors: 2, memory: 0 } },
    });
  });

  it("reduces hazard losses after Elliptic Hull Polytopes", () => {
    const base = spaceGame();
    const protectedGame = spaceGame();
    for (const game of [base, protectedGame]) {
      seed(game, (transaction) => transaction.set(paperclipsResources.probes, 1_000));
    }
    seed(protectedGame, (transaction) =>
      transaction.setProgress("upgrade", "elliptic-hull-polytopes"),
    );
    base.advance(1_000);
    protectedGame.advance(1_000);
    expect(protectedGame.getSnapshot().resources["hazard-losses"]).toBeCloseTo(
      (base.getSnapshot().resources["hazard-losses"] as number) / 2,
    );
  });

  it("completes either accepted prestige branch", () => {
    for (const [project, resource] of [
      ["universe-next-door", "universe-prestige"],
      ["universe-within", "simulation-prestige"],
    ] as const) {
      const game = spaceGame();
      seed(game, (transaction) => {
        transaction.setProgress("upgrade", "accept-exile");
        transaction.set(paperclipsResources.operations, 300_000);
        transaction.set(paperclipsResources.creativity, 300_000);
      });
      expect(game.dispatch({ type: "project", id: project }), project).toMatchObject({ ok: true });
      expect(game.getSnapshot().resources[resource]).toBe(1);
      expect(game.getSnapshot().progression.won).toBe(true);
    }
  });

  it("runs the timed rejection dismantling sequence to completion", () => {
    const game = spaceGame();
    seed(game, (transaction) => {
      transaction.setProgress("upgrade", "reject-exile");
      transaction.set(paperclipsResources.operations, 600_000);
      transaction.set(paperclipsResources.wire, 0);
      transaction.set(paperclipsResources.computeCapacity, 600);
      transaction.setAllocation("compute", "processors", 0);
      transaction.setAllocation("compute", "memory", 600);
    });
    const stages = [
      [10_000, "disassemble-probes"],
      [4_000, "disassemble-swarm"],
      [3_000, "disassemble-factories"],
      [2_000, "disassemble-strategy"],
      [1_000, "disassemble-quantum"],
      [3_000, "disassemble-processors"],
      [2_000, "disassemble-memory"],
    ] as const;
    for (const [milliseconds, project] of stages) {
      expect(game.advance(milliseconds)).toMatchObject({ ok: true });
      expect(game.dispatch({ type: "project", id: project }), project).toMatchObject({ ok: true });
    }
    expect(game.getSnapshot().resources.wire).toBe(90);
    expect(paperclipsFullQuotes(game.getSnapshot()).map((quote) => quote.id)).toContain(
      "make-clip",
    );
    expect(game.dispatch({ type: "make-clip", count: 90 })).toMatchObject({ ok: true });
    game.advance(5_000);
    expect(game.getSnapshot().progression.won).toBe(true);
    expect(paperclipsFullQuotes(game.getSnapshot())).toEqual([]);
  });

  it("exposes temporal reversion and Xavier compute reset conditions", () => {
    const ending = spaceGame();
    seed(ending, (transaction) => {
      transaction.setProgress("upgrade", "disassemble-memory");
      transaction.set(paperclipsResources.operations, -10_000);
    });
    expect(ending.dispatch({ type: "project", id: "quantum-temporal-reversion" })).toMatchObject({
      ok: true,
    });
    expect(ending.getSnapshot().progression.won).toBe(true);

    const fresh = createPaperclipsReference();
    seed(fresh, (transaction) => {
      transaction.set(paperclipsResources.creativity, 100_000);
      transaction.set(paperclipsResources.computeCapacity, 10);
      transaction.setAllocation("compute", "processors", 5);
      transaction.setAllocation("compute", "memory", 5);
    });
    expect(fresh.dispatch({ type: "project", id: "xavier-reinitialization" })).toMatchObject({
      ok: true,
    });
    expect(fresh.getSnapshot().allocations.compute).toEqual({ processors: 0, memory: 0 });
  });
});

function spaceGame() {
  const game = createPaperclipsReference();
  seed(game, (transaction) => {
    transaction.setProgress("milestone", "industry-phase");
    transaction.setProgress("milestone", "space-phase");
  });
  return game;
}

function seed(
  reference: ReturnType<typeof createPaperclipsReference>,
  apply: (transaction: Transaction<number>) => void,
): void {
  reference.game.dispatch({ id: "paperclips-ending-seed", execute: apply });
}
