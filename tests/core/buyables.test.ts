import { describe, expect, it } from "vitest";
import {
  buyCommand,
  createGame,
  createGameKit,
  eternityNumbers,
  geometricCurve,
  nativeNumbers,
  sellCommand,
} from "../../packages/core/src/index.js";

function fixture(balance = 100, capacity?: number) {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const money = kit.resource("money", {
    scope: run,
    initial: balance,
    ...(capacity === undefined ? {} : { capacity }),
  });
  const machine = kit.buyable("machine", {
    scope: run,
    currency: money,
    curve: geometricCurve(nativeNumbers, { base: 10, ratio: 2 }),
    refundRate: 0.5,
  });
  const game = createGame(
    kit.defineGame({
      id: "buyable",
      simulationVersion: 1,
      stepMs: 50,
      resources: [money],
      buyables: [machine],
    }),
  );
  return { game, kit, machine, money, run };
}

describe("buyables", () => {
  it("buys exact quantities atomically", () => {
    const { game, machine } = fixture();
    expect(game.dispatch(buyCommand(machine, { mode: "exact", count: 3 })).ok).toBe(true);
    expect(game.getSnapshot().resources.money).toBe(30);
    expect(game.getSnapshot().purchaseCounts.machine).toBe(3);
  });

  it("max-buys without repeated actions", () => {
    const { game, machine } = fixture(150);
    game.dispatch(buyCommand(machine, { mode: "max" }));
    expect(game.getSnapshot().resources.money).toBe(0);
    expect(game.getSnapshot().purchaseCounts.machine).toBe(4);
  });

  it("sells selected quantities or respecs all with the refund rate", () => {
    const { game, machine } = fixture();
    game.dispatch(buyCommand(machine, { mode: "exact", count: 3 }));
    game.dispatch(sellCommand(machine, 2));
    expect(game.getSnapshot().purchaseCounts.machine).toBe(1);
    expect(game.getSnapshot().resources.money).toBe(60);
    game.dispatch(sellCommand(machine));
    expect(game.getSnapshot().purchaseCounts.machine).toBe(0);
    expect(game.getSnapshot().resources.money).toBe(65);
  });

  it("returns structured insufficient and invalid-count failures", () => {
    const { game, machine } = fixture(9);
    expect(game.dispatch(buyCommand(machine, { mode: "exact", count: 1 }))).toEqual({
      ok: false,
      error: { code: "insufficient", resourceId: "money", required: 10, available: 9 },
    });
    expect(game.dispatch(buyCommand(machine, { mode: "max" }))).toEqual({
      ok: false,
      error: { code: "insufficient", resourceId: "money", required: 10, available: 9 },
    });
    expect(game.dispatch(buyCommand(machine, { mode: "exact", count: 0 }))).toEqual({
      ok: false,
      error: { code: "invalid-count", requested: 0 },
    });
  });

  it("rejects selling more than owned and rolls back capacity failures", () => {
    const { game, machine } = fixture(50, 50);
    expect(game.dispatch(sellCommand(machine, 1))).toEqual({
      ok: false,
      error: { code: "invalid-count", requested: 1 },
    });
    game.dispatch(buyCommand(machine, { mode: "exact", count: 1 }));
    game.dispatch({
      id: "refill",
      execute: (transaction) => transaction.set(machine.currency, 50),
    });
    expect(game.dispatch(sellCommand(machine))).toEqual({
      ok: false,
      error: { code: "capacity-blocked", resourceId: "money", attempted: 55, capacity: 50 },
    });
  });

  it("stores numeric-backed counts beyond native range", () => {
    const kit = createGameKit({ numbers: eternityNumbers });
    const run = kit.scope("run");
    const money = kit.resource("money", { scope: run, initial: kit.q("10") });
    const huge = kit.buyable("huge", {
      scope: run,
      currency: money,
      curve: geometricCurve(eternityNumbers, { base: kit.q("1"), ratio: kit.q("1") }),
      initialCount: kit.q("1e400"),
    });
    const game = createGame(
      kit.defineGame({
        id: "huge-count",
        simulationVersion: 1,
        stepMs: 50,
        resources: [money],
        buyables: [huge],
      }),
    );
    const count = game.getSnapshot().purchaseCounts.huge;
    expect(count).toBeDefined();
    if (count === undefined) throw new Error("missing huge count");
    expect(eternityNumbers.codec.serialize(count)).toBe("1e400");
  });

  it("validates buyable definitions", () => {
    const { kit, run, money } = fixture();
    const other = fixture();
    const curve = geometricCurve(nativeNumbers, { base: 1, ratio: 2 });
    expect(() => kit.buyable("bad", { scope: other.run, currency: money, curve })).toThrow(
      "another game kit",
    );
    expect(() => kit.buyable("bad", { scope: run, currency: other.money, curve })).toThrow(
      "another game kit",
    );
    expect(() =>
      kit.buyable("bad", { scope: run, currency: money, curve, initialCount: 1.2 }),
    ).toThrow("nonnegative integer");
    expect(() => kit.buyable("bad", { scope: run, currency: money, curve, refundRate: 2 })).toThrow(
      "between zero and one",
    );
  });
});
