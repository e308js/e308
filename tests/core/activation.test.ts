import { describe, expect, it } from "vitest";
import {
  buyCommand,
  completeChallengeCommand,
  createGame,
  createGameKit,
  enterChallengeCommand,
  geometricCurve,
  nativeNumbers,
  upgradeCommand,
} from "../../packages/core/src/index.js";

describe("scope activation", () => {
  it("blocks scoped effects and actions until its progression predicate is active", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const account = kit.scope("account");
    const points = kit.resource("points", { scope: run, initial: 100 });
    const keys = kit.resource("keys", { scope: account, initial: 1 });
    const machine = kit.buyable("machine", {
      scope: run,
      currency: points,
      curve: geometricCurve(nativeNumbers, { base: 10, ratio: 1 }),
    });
    const unlock = kit.upgrade("unlock-run", {
      scope: account,
      costs: [[keys, 1]],
      prerequisiteIds: [],
      unlocked: () => true,
    });
    const runUpgrade = kit.upgrade("run-upgrade", {
      scope: run,
      costs: [],
      prerequisiteIds: [],
      unlocked: () => true,
    });
    const runChallenge = kit.challenge("run-challenge", {
      scope: run,
      maxCompletions: 1,
      enterReset: { clear: [run] },
      exitReset: { clear: [run] },
      canEnter: () => true,
      completionsEarned: () => 0,
    });
    const activation = kit.scopeActivation("run-active", {
      scope: run,
      active: (state) => state.hasUpgrade(unlock.id),
    });
    const income = kit.flow("income", {
      scope: run,
      rate: kit.rates.constant(10),
      produces: [[points, 1]],
    });
    const bonus = kit.steppedRule("bonus", {
      scope: run,
      update: (transaction) => transaction.add(points, 1),
    });
    const earlierBonus = kit.steppedRule("earlier-bonus", {
      scope: run,
      priority: -1,
      update: (transaction) => transaction.add(points, 2),
    });
    const laterBonus = kit.steppedRule("later-bonus", {
      scope: run,
      update: (transaction) => transaction.add(points, 3),
    });
    const game = createGame(
      kit.defineGame({
        id: "activation-test",
        simulationVersion: 1,
        stepMs: 100,
        resources: [points, keys],
        flows: [income],
        buyables: [machine],
        upgrades: [unlock, runUpgrade],
        challenges: [runChallenge],
        scopeActivations: [activation],
        steppedRules: [laterBonus, bonus, earlierBonus],
      }),
    );

    game.advance(100);
    expect(game.getSnapshot().resources.points).toBe(100);
    expect(game.dispatch(buyCommand(machine, { mode: "exact", count: 1 }))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "scope-inactive" },
    });
    expect(game.dispatch(upgradeCommand(runUpgrade))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "scope-inactive" },
    });
    expect(game.dispatch(enterChallengeCommand(runChallenge, [runChallenge]))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "scope-inactive" },
    });
    expect(game.dispatch(completeChallengeCommand(runChallenge))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "scope-inactive" },
    });

    expect(game.dispatch(upgradeCommand(unlock)).ok).toBe(true);
    game.advance(100);
    expect(game.getSnapshot().resources.points).toBe(107);
    expect(game.dispatch(buyCommand(machine, { mode: "exact", count: 1 })).ok).toBe(true);
  });

  it("rejects activations built with a foreign scope", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const other = createGameKit({ numbers: nativeNumbers });
    expect(() =>
      kit.scopeActivation("foreign", { scope: other.scope("run"), active: () => true }),
    ).toThrow("another game kit");
    const local = kit.scope("local");
    const points = kit.resource("points", { scope: local, initial: 0 });
    const game = createGame(
      kit.defineGame({
        id: "foreign-activation-query",
        simulationVersion: 1,
        stepMs: 100,
        resources: [points],
      }),
    );
    expect(
      game.dispatch({
        id: "foreign-query",
        execute: (transaction) => void transaction.isScopeActive(other.scope("elsewhere")),
      }),
    ).toEqual({ ok: false, error: { code: "invalid-target", id: "elsewhere" } });
  });
});
