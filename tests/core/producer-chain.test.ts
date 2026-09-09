import { advanceProducerChain, createGame, createGameKit, nativeNumbers } from "@e308/core";
import { describe, expect, it } from "vitest";

function fixture(rate = ({ amount }: { amount: number }) => amount) {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const points = kit.resource("points", { scope: run, initial: 0 });
  const tiers = [
    kit.resource("tier-1", { scope: run, initial: 0 }),
    kit.resource("tier-2", { scope: run, initial: 0 }),
  ];
  const rule = kit.steppedRule("chain", {
    scope: run,
    update: (transaction, seconds) =>
      advanceProducerChain(transaction, { output: points, tiers, seconds, rate }),
  });
  const definition = kit.defineGame({
    id: "producer-chain-test",
    simulationVersion: 1,
    stepMs: 1_000,
    resources: [points, ...tiers],
    steppedRules: [rule],
  });
  return { game: createGame(definition), points, tiers };
}

describe("producer chains", () => {
  it("uses stable tier amounts and delays propagation by one step", () => {
    const { game, tiers } = fixture();
    const tier2 = tiers[1];
    if (!tier2) throw new TypeError("Fixture is missing tier 2");
    game.dispatch({
      id: "seed",
      execute: (transaction) => transaction.set(tier2, 2),
    });
    game.advance(1_000);
    expect(game.getSnapshot()).toMatchObject({
      resources: { points: 0, "tier-1": 2, "tier-2": 2 },
      productionTotals: { points: 0, "tier-1": 2 },
    });
    game.advance(1_000);
    expect(game.getSnapshot().resources.points).toBe(2);
  });

  it("rejects invalid elapsed time, empty chains, and negative rates", () => {
    const { game, points, tiers } = fixture(() => -1);
    expect(game.advance(1_000)).toMatchObject({ ok: false, error: { code: "numeric-fault" } });
    expect(
      game.dispatch({
        id: "invalid",
        execute: (transaction) =>
          advanceProducerChain(transaction, { output: points, tiers, seconds: -1, rate: () => 1 }),
      }),
    ).toMatchObject({ ok: false, error: { code: "transaction-failed" } });
    expect(
      game.dispatch({
        id: "empty",
        execute: (transaction) =>
          advanceProducerChain(transaction, {
            output: points,
            tiers: [],
            seconds: 1,
            rate: () => 1,
          }),
      }),
    ).toMatchObject({ ok: false, error: { code: "transaction-failed" } });
  });
});
