import { readFileSync } from "node:fs";
import type { EternityQuantity, Transaction } from "@e308/core";
import { describe, expect, it } from "vitest";
import {
  arrayGenerators,
  arrayResources,
  boosterator,
  createArrayReference,
  encode,
  q,
  required,
} from "../../reference/array/index.js";

const golden = JSON.parse(
  readFileSync(new URL("../../reference/array/golden-trace.json", import.meta.url), "utf8"),
) as {
  readonly relativeTolerance: number;
  readonly checkpoints: Readonly<Record<string, Readonly<Record<string, number>>>>;
};

describe("Array Game pinned source trace", () => {
  it("matches the opening purchase and 16 ms production trace", () => {
    const expected = checkpoint("firstA1Purchase");
    const game = createArrayReference();
    expect(game.dispatch({ type: "buy-generator", family: "A", tier: 1, mode: "one" })).toEqual(
      expect.objectContaining({ ok: true }),
    );
    compare(game, { A: requiredGolden(expected.A), a1: requiredGolden(expected.a1) });
    expect(number(game.getSnapshot().purchaseCounts["a-generator-1-bought"])).toBe(
      requiredGolden(expected.a1Bought),
    );
    game.advance(1_600);
    compare(game, checkpoint("firstA1After1600ms"));
  });

  it("matches source-style elapsed production and the first B reset", () => {
    const elapsed = createArrayReference();
    seed(elapsed, (transaction) => {
      transaction.set(required(arrayGenerators.A.amounts[0], "A-1"), q("10"));
      transaction.set(required(arrayGenerators.A.amounts[1], "A-2"), q("10"));
    });
    elapsed.advanceAway(60_000);
    compare(elapsed, checkpoint("oneMinuteElapsedWithTenA1AndTenA2"));

    const prestige = createArrayReference();
    seed(prestige, (transaction) => transaction.set(arrayResources.A, q("1e15")));
    prestige.dispatch({ type: "prestige-b" });
    compare(prestige, checkpoint("prestigeAt1e15A"));
  });

  it("matches the source boosterator formula", () => {
    const game = createArrayReference();
    seed(game, (transaction) => {
      transaction.setProgress("milestone", "array-b-unlocked");
      transaction.setPurchase(boosterator.id, q("2"));
    });
    game.advanceAway(1_000);
    compare(game, checkpoint("twoBoosteratorsAfter992ms"));
  });
});

function checkpoint(id: string): Readonly<Record<string, number>> {
  const value = golden.checkpoints[id];
  if (!value) throw new TypeError(`Missing golden checkpoint: ${id}`);
  return value;
}

function compare(
  game: ReturnType<typeof createArrayReference>,
  expected: Readonly<Record<string, number>>,
): void {
  const snapshot = game.getSnapshot();
  const actual = {
    A: number(snapshot.resources["array-a"]),
    B: number(snapshot.resources["array-b"]),
    a1: number(snapshot.resources["a-generator-1"]),
    boosters: number(snapshot.resources["a-boosters"]),
  };
  for (const [id, value] of Object.entries(expected)) {
    if (id === "a1Bought") continue;
    expect(actual[id as keyof typeof actual]).toBeCloseTo(value, toleranceDigits());
  }
}

function number(value: EternityQuantity | undefined): number {
  return Number(encode(required(value, "golden quantity")));
}

function toleranceDigits(): number {
  return Math.floor(-Math.log10(golden.relativeTolerance));
}

function requiredGolden(value: number | undefined): number {
  if (value === undefined) throw new TypeError("Missing golden value");
  return value;
}

function seed(
  game: ReturnType<typeof createArrayReference>,
  apply: (transaction: Transaction<EternityQuantity>) => void,
): void {
  game.game.dispatch({ id: "array-golden-seed", execute: apply });
}
