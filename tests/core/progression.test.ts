import { describe, expect, it } from "vitest";
import {
  createGame,
  createGameKit,
  nativeNumbers,
  upgradeCommand,
} from "../../packages/core/src/index.js";

describe("upgrades, milestones, achievements, and win state", () => {
  it("pays once and resolves ordered trigger cascades atomically", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const points = kit.resource("points", { scope: run, initial: 0 });
    const bonus = kit.resource("bonus", { scope: run, initial: 0 });
    const allocation = kit.allocation("allocation", {
      scope: run,
      budget: bonus,
      targets: ["slot"],
    });
    const upgrade = kit.upgrade("engine", {
      scope: run,
      costs: [[points, 10]],
      prerequisiteIds: [],
      unlocked: () => true,
      apply: (tx) => tx.add(bonus, 1),
    });
    const second = kit.milestone("second", {
      scope: run,
      priority: -1,
      when: (state) => state.hasMilestone("first"),
      apply: (tx) => tx.add(bonus, 1),
    });
    const first = kit.milestone("first", {
      scope: run,
      when: (state) => state.hasUpgrade("engine") && state.getAllocation(allocation, "slot") === 0,
      apply: (tx) => tx.add(bonus, 1),
    });
    const achievement = kit.achievement("ready", {
      scope: run,
      when: (state) => state.get(bonus) >= 3,
    });
    const game = createGame(
      kit.defineGame({
        id: "progression",
        simulationVersion: 1,
        stepMs: 50,
        resources: [points, bonus],
        upgrades: [upgrade],
        allocations: [allocation],
        triggers: [second, achievement, first],
        win: (state) => state.hasAchievement("ready"),
      }),
    );
    expect(game.dispatch(upgradeCommand(upgrade))).toMatchObject({
      ok: false,
      error: { code: "insufficient", resourceId: "points" },
    });
    game.dispatch({ id: "fund", execute: (tx) => tx.set(points, 10) });
    expect(game.dispatch(upgradeCommand(upgrade)).ok).toBe(true);
    expect(game.getSnapshot().progression).toMatchObject({
      upgrades: { engine: true },
      milestones: { first: true, second: true },
      achievements: { ready: true },
      won: true,
    });
    expect(game.getSnapshot().resources).toEqual({ points: 0, bonus: 3 });
    expect(game.dispatch(upgradeCommand(upgrade))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "already-owned" },
    });
  });

  it("does not reveal an unavailable upgrade beyond its declared prerequisites", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const points = kit.resource("points", { scope: run, initial: 10 });
    const upgrade = kit.upgrade("secret", {
      scope: run,
      costs: [[points, 1]],
      prerequisiteIds: ["public-step"],
      unlocked: () => false,
    });
    const game = createGame(
      kit.defineGame({
        id: "locked-upgrade",
        simulationVersion: 1,
        stepMs: 50,
        resources: [points],
        upgrades: [upgrade],
      }),
    );
    expect(game.dispatch(upgradeCommand(upgrade))).toEqual({
      ok: false,
      error: { code: "locked", prerequisiteIds: ["public-step"] },
    });
    expect(() =>
      kit.automation("bad", {
        scope: run,
        cadenceMs: 0,
        initiallyEnabled: false,
        unlocked: () => true,
        condition: () => true,
        action: () => ({ id: "noop", execute: () => undefined }),
      }),
    ).toThrow("Cadence");
    expect(() =>
      kit.challenge("bad", {
        scope: run,
        maxCompletions: 0,
        enterReset: { clear: [run] },
        exitReset: { clear: [run] },
        canEnter: () => true,
        completionsEarned: () => 0,
      }),
    ).toThrow("completion limit");
  });

  it("uses stable IDs for equal-priority triggers", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const value = kit.resource("value", { scope: run, initial: 0 });
    const z = kit.milestone("z-last", {
      scope: run,
      when: () => true,
      apply: (tx) => tx.set(value, tx.get(value) * 10 + 2),
    });
    const a = kit.milestone("a-first", {
      scope: run,
      when: () => true,
      apply: (tx) => tx.set(value, tx.get(value) * 10 + 1),
    });
    const game = createGame(
      kit.defineGame({
        id: "trigger-order",
        simulationVersion: 1,
        stepMs: 50,
        resources: [value],
        triggers: [z, a],
      }),
    );
    game.dispatch({ id: "resolve", execute: () => undefined });
    expect(game.getSnapshot().resources.value).toBe(12);
  });
});
