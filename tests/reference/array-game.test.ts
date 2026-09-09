import {
  beginCatchup,
  type CatchupSession,
  type EternityQuantity,
  processCatchupChunk,
  type Transaction,
} from "@e308/core";
import { describe, expect, it } from "vitest";
import {
  advanceArrayAway,
  arrayDefinition,
  arrayGenerators,
  arrayGeometricCurve,
  arrayResources,
  arraySaveCodec,
  aUpgradeBuyables,
  createArrayReference,
  encode,
  importArrayReference,
  q,
  required,
} from "../../reference/array/index.js";

const value = (quantity: EternityQuantity | undefined) =>
  Number(encode(required(quantity, "test quantity")));

describe("Array Game A/B reference", () => {
  it("matches initial generator prices and delayed chain production", () => {
    const game = createArrayReference();
    expect(
      game.dispatch({ type: "buy-generator", family: "A", tier: 1, mode: "one" }),
    ).toMatchObject({ ok: true });
    expect(value(game.getSnapshot().resources["array-a"])).toBe(0);
    game.advance(1_600);
    expect(value(game.getSnapshot().resources["array-a"])).toBeCloseTo(1.6);

    seed(game, (transaction) => {
      transaction.set(arrayResources.A, q("100"));
      transaction.set(required(arrayGenerators.A.amounts[1], "A-2 generator"), q("10"));
    });
    game.advance(16);
    expect(value(game.getSnapshot().resources["a-generator-1"])).toBeCloseTo(1.016);
    expect(value(game.getSnapshot().resources["array-a"])).toBeCloseTo(100.016);
  });

  it("uses the source threshold multiplier only beyond twenty purchases", () => {
    const game = createArrayReference();
    seed(game, (transaction) => {
      transaction.set(arrayResources.A, q("0"));
      transaction.set(required(arrayGenerators.A.amounts[0], "A-1 generator"), q("21"));
      transaction.setPurchase(required(arrayGenerators.A.buyables[0], "A-1 buyable").id, q("21"));
    });
    game.advance(1_000);
    const expected = 21 * 2 ** 0.2 * 0.992;
    expect(value(game.getSnapshot().resources["array-a"])).toBeCloseTo(expected, 8);
  });

  it("matches floored single prices and source geometric bulk purchases", () => {
    const curve = arrayGeometricCurve(q("10"), q("1.2"));
    expect(value(curve.unitCost(q("2")))).toBe(14);
    expect(value(curve.totalCost(q("0"), q("3")))).toBeCloseTo(36.4);
    expect(value(curve.maxAffordable(q("100"), q("0")))).toBe(6);
    expect(() => required(undefined, "fixture value")).toThrow("fixture value");

    const game = createArrayReference();
    seed(game, (transaction) => {
      transaction.set(arrayResources.A, q("14"));
      transaction.setPurchase(required(arrayGenerators.A.buyables[0], "A-1 buyable").id, q("2"));
    });
    expect(
      game.dispatch({ type: "buy-generator", family: "A", tier: 1, mode: "one" }),
    ).toMatchObject({
      ok: true,
    });
    expect(value(game.getSnapshot().resources["array-a"])).toBe(0);
  });

  it("resets A for the exact logarithmic B reward and unlocks B", () => {
    const game = createArrayReference();
    seed(game, (transaction) => transaction.set(arrayResources.A, q("1e10")));
    expect(game.dispatch({ type: "prestige-b" })).toMatchObject({ ok: true });
    expect(value(game.getSnapshot().resources["array-a"])).toBe(10);
    expect(value(game.getSnapshot().resources["array-b"])).toBe(1);
    expect(game.getSnapshot().progression.milestones).toHaveProperty("array-b-unlocked");
    expect(
      game.dispatch({ type: "buy-generator", family: "B", tier: 1, mode: "one" }),
    ).toMatchObject({
      ok: false,
      error: { code: "insufficient" },
    });
  });

  it("applies B upgrades, generator coupling, and boosterator production", () => {
    const game = createArrayReference();
    seed(game, (transaction) => {
      transaction.setProgress("milestone", "array-b-unlocked");
      transaction.set(arrayResources.B, q("10000000"));
      transaction.set(required(arrayGenerators.A.amounts[0], "A-1 generator"), q("1"));
      transaction.setPurchase(required(arrayGenerators.B.buyables[0], "B-1 buyable").id, q("2"));
    });
    expect(game.dispatch({ type: "buy-b-upgrade", id: "b-count-boosts-a" })).toMatchObject({
      ok: true,
    });
    expect(game.dispatch({ type: "buy-b-upgrade", id: "stronger-boosterators" })).toMatchObject({
      ok: true,
    });
    expect(game.dispatch({ type: "buy-boosterator", mode: "one" })).toMatchObject({ ok: true });
    const beforeA = value(game.getSnapshot().resources["array-a"]);
    game.advance(1_000);
    expect(value(game.getSnapshot().resources["array-a"]) - beforeA).toBeGreaterThan(3);
    expect(value(game.getSnapshot().resources["a-boosters"])).toBeCloseTo(0.992, 8);
  });

  it("runs passive B, boosted B production, and the stronger purchase threshold", () => {
    const game = createArrayReference();
    seed(game, (transaction) => {
      transaction.setProgress("milestone", "array-b-unlocked");
      for (const id of ["passive-b", "stronger-a-count", "hundredfold-b", "b1-boosters"]) {
        transaction.setProgress("upgrade", id);
      }
      transaction.set(arrayResources.A, q("1e10"));
      transaction.set(arrayResources.B, q("0"));
      transaction.set(required(arrayGenerators.A.amounts[0], "A-1 generator"), q("21"));
      transaction.set(required(arrayGenerators.B.amounts[0], "B-1 generator"), q("1"));
      transaction.setPurchase(required(arrayGenerators.A.buyables[0], "A-1 buyable").id, q("21"));
      transaction.setPurchase(required(arrayGenerators.B.buyables[0], "B-1 buyable").id, q("1"));
      transaction.setPurchase("a-boosterators", q("1"));
    });
    game.advance(16);
    expect(value(game.getSnapshot().resources["array-b"])).toBeCloseTo(1.0032);
    expect(value(game.getSnapshot().resources["a-generator-5"])).toBeCloseTo(1.6);
    expect(value(game.getSnapshot().resources["a-boosters"])).toBeCloseTo(0.032);
    expect(value(game.getSnapshot().resources["array-a"])).toBeGreaterThan(1e10);
  });

  it("covers legal max buys and structured command failures", () => {
    const game = createArrayReference();
    expect(game.dispatch({ type: "prestige-b" })).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    expect(
      game.dispatch({ type: "buy-generator", family: "B", tier: 1, mode: "one" }),
    ).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    expect(
      game.dispatch({ type: "buy-generator", family: "A", tier: 9, mode: "one" }),
    ).toMatchObject({
      ok: false,
      error: { code: "invalid-target" },
    });
    expect(game.dispatch({ type: "buy-a-upgrade", index: 9, mode: "one" })).toMatchObject({
      ok: false,
      error: { code: "invalid-target" },
    });
    expect(game.dispatch({ type: "buy-b-upgrade", id: "missing" })).toMatchObject({
      ok: false,
      error: { code: "invalid-target" },
    });
    seed(game, (transaction) => transaction.set(arrayResources.A, q("100")));
    expect(
      game.dispatch({ type: "buy-generator", family: "A", tier: 1, mode: "max" }),
    ).toMatchObject({
      ok: true,
    });
    expect(value(game.getSnapshot().purchaseCounts["a-generator-1-bought"])).toBe(6);
  });

  it("honors B upgrade thresholds and the no-spend unlock", () => {
    const game = createArrayReference();
    seed(game, (transaction) => {
      transaction.setProgress("milestone", "array-b-unlocked");
      transaction.set(arrayResources.B, q("20"));
    });
    expect(game.dispatch({ type: "buy-b-upgrade", id: "a-upgrade-max" })).toMatchObject({
      ok: true,
    });
    expect(value(game.getSnapshot().resources["array-b"])).toBe(20);
    expect(game.dispatch({ type: "buy-b-upgrade", id: "a-upgrade-max" })).toMatchObject({
      ok: false,
      error: { code: "disabled" },
    });
    expect(game.dispatch({ type: "buy-b-upgrade", id: "stronger-a-count" })).toMatchObject({
      ok: false,
      error: { code: "insufficient" },
    });
  });

  it("preserves deterministic state across time partitions", () => {
    const left = createArrayReference();
    const right = createArrayReference();
    for (const game of [left, right]) {
      seed(game, (transaction) => {
        transaction.set(arrayResources.A, q("1e12"));
        transaction.set(required(arrayGenerators.A.amounts[0], "A-1 generator"), q("5"));
        transaction.setPurchase(required(aUpgradeBuyables[0], "A upgrade 1").id, q("2"));
      });
    }
    left.advance(1_600);
    for (let index = 0; index < 10; index += 1) right.advance(160);
    expect({ ...left.getSnapshot(), revision: 0n }).toEqual({
      ...right.getSnapshot(),
      revision: 0n,
    });
  });

  it("round-trips high magnitudes through the numeric save codec", () => {
    const game = createArrayReference();
    seed(game, (transaction) => {
      transaction.set(arrayResources.A, q("1e180"));
      transaction.set(arrayResources.B, q("1e10"));
      transaction.setProgress("milestone", "array-b-unlocked");
    });
    const restored = importArrayReference(game.exportSave(123_456));
    expect(encode(required(restored.getSnapshot().resources["array-a"], "restored A"))).toBe(
      "1e180",
    );
    expect(encode(required(restored.getSnapshot().resources["array-b"], "restored B"))).toBe(
      "10000000000",
    );
    expect(restored.getSnapshot().progression.milestones).toHaveProperty("array-b-unlocked");
  });

  it("applies one source-style elapsed update during an absence", () => {
    const game = createArrayReference();
    seed(game, (transaction) => {
      transaction.set(required(arrayGenerators.A.amounts[0], "A-1 generator"), q("10"));
      transaction.set(required(arrayGenerators.A.amounts[1], "A-2 generator"), q("10"));
    });
    const result = advanceArrayAway(game.game, 60_000);
    expect(result).toMatchObject({ ok: true });
    expect(value(game.getSnapshot().resources["array-a"])).toBe(610);
    expect(value(game.getSnapshot().resources["a-generator-1"])).toBe(70);
    expect(game.getSnapshot().gameTimeMs).toBe(60_000);
  });

  it("resumes an interrupted canonical catch-up exactly", () => {
    const saved = createArrayReference();
    seed(saved, (transaction) => {
      transaction.set(required(arrayGenerators.A.amounts[0], "A-1 generator"), q("10"));
    });
    const loaded = arraySaveCodec.decode(saved.exportSave(1_000));
    const started = beginCatchup(arrayDefinition, loaded, 2_600, "array-interrupted");
    const resumed = createArrayReference(started.snapshot);
    const first = processCatchupChunk(
      arrayDefinition,
      resumed.game,
      requiredSession(started.catchup),
      50,
    );
    expect(first).toMatchObject({ ok: false, error: { code: "budget-exceeded" } });
    if (first.ok) throw new TypeError("Expected interrupted catch-up");
    const second = processCatchupChunk(arrayDefinition, resumed.game, first.error.session, 50);
    expect(second).toMatchObject({ ok: true, value: { complete: true } });

    const direct = createArrayReference(loaded.snapshot);
    direct.advance(1_600);
    expect({ ...resumed.getSnapshot(), revision: 0n }).toEqual({
      ...direct.getSnapshot(),
      revision: 0n,
    });
  });
});

function requiredSession(session: CatchupSession | null): CatchupSession {
  if (!session) throw new TypeError("Expected catch-up session");
  return session;
}

function seed(
  reference: ReturnType<typeof createArrayReference>,
  apply: (transaction: Transaction<EternityQuantity>) => void,
): void {
  reference.game.dispatch({ id: "array-test-seed", execute: apply });
}
