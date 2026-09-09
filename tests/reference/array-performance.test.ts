import { performance } from "node:perf_hooks";
import type { Transaction } from "@e308/core";
import { describe, expect, it } from "vitest";
import {
  type ArrayQuantity,
  arrayGenerators,
  arrayResources,
  createArrayReference,
  q,
} from "../../reference/array/index.js";

describe("Array Game high-frequency simulation", () => {
  it("advances 3,750 populated 16 ms ticks within the CI budget", () => {
    const game = createArrayReference();
    game.game.dispatch({
      id: "array-performance-seed",
      execute: (transaction) => populate(transaction),
    });
    const started = performance.now();
    const result = game.advance(60_000);
    const elapsed = performance.now() - started;
    expect(result).toMatchObject({ ok: true });
    expect(game.getSnapshot().gameTimeMs).toBe(60_000);
    expect(elapsed).toBeLessThan(2_500);
  });
});

function populate(transaction: Transaction<ArrayQuantity>): void {
  transaction.setProgress("milestone", "array-b-unlocked");
  transaction.set(arrayResources.A, q("1e100"));
  transaction.set(arrayResources.B, q("1e50"));
  for (const family of [arrayGenerators.A, arrayGenerators.B]) {
    family.amounts.forEach((amount) => {
      transaction.set(amount, q("1e20"));
    });
    family.buyables.forEach((buyable) => {
      transaction.setPurchase(buyable.id, q("100"));
    });
  }
}
