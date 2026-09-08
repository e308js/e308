import { describe, expect, it } from "vitest";
import {
  automationCommand,
  buyCommand,
  completeChallengeCommand,
  createGame,
  createGameKit,
  enterChallengeCommand,
  geometricCurve,
  nativeNumbers,
  prestigeCommand,
  upgradeCommand,
} from "../../packages/core/src/index.js";

function fixture() {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const account = kit.scope("account");
  const points = kit.resource("points", { scope: run, initial: 0 });
  const kept = kit.resource("kept", { scope: run, initial: 1 });
  const stars = kit.resource("stars", { scope: account, initial: 0 });
  const slots = kit.allocation("slots", { scope: run, budget: kept, targets: ["machine"] });
  const machine = kit.buyable("machine", {
    scope: run,
    currency: points,
    curve: geometricCurve(nativeNumbers, { base: 10, ratio: 1 }),
  });
  const prestige = kit.prestige("stars", {
    scope: run,
    reward: stars,
    manifest: { clear: [run], retain: { resources: [kept] } },
    prerequisiteIds: ["points:100"],
    canReset: (state) => state.get(points) >= 100 && state.getAllocation(slots, "machine") >= 0,
    rewardFor: (state) => Math.floor(Math.sqrt(state.get(points) / 100)),
  });
  const game = createGame(
    kit.defineGame({
      id: "reset-test",
      simulationVersion: 1,
      stepMs: 50,
      resources: [points, kept, stars],
      buyables: [machine],
      allocations: [slots],
      prestiges: [prestige],
    }),
  );
  return { game, kit, run, account, points, kept, stars, slots, machine, prestige };
}

describe("prestige resets", () => {
  it("quotes reward before reset, retains declared fields, and resets newly tagged state", () => {
    const { game, points, kept, machine, prestige } = fixture();
    game.dispatch({
      id: "seed",
      execute: (tx) => {
        tx.set(points, 410);
        tx.set(kept, 7);
      },
    });
    game.dispatch(buyCommand(machine, { mode: "exact", count: 1 }));
    expect(game.dispatch(prestigeCommand(prestige)).ok).toBe(true);
    expect(game.getSnapshot()).toMatchObject({
      resources: { points: 0, kept: 7, stars: 2 },
      purchaseCounts: { machine: 0 },
      scopeGenerations: { run: 1n },
    });
  });

  it("returns a public lock reason and rejects stale queued scope commands", () => {
    const { game, points, run, prestige } = fixture();
    expect(game.dispatch(prestigeCommand(prestige))).toEqual({
      ok: false,
      error: { code: "locked", prerequisiteIds: ["points:100"] },
    });
    game.dispatch({ id: "seed", execute: (tx) => tx.set(points, 100) });
    game.dispatch(prestigeCommand(prestige));
    expect(
      game.dispatch({
        id: "queued",
        expectedScopeGenerations: { [run.id]: 0n },
        execute: (tx) => tx.add(points, 1),
      }),
    ).toEqual({ ok: false, error: { code: "stale-revision", expected: 0n, current: 1n } });
  });

  it("rejects invalid rewards, foreign manifests, and retention outside a cleared scope", () => {
    const { game, kit, run, points, stars, prestige } = fixture();
    game.dispatch({ id: "seed", execute: (tx) => tx.set(points, 100) });
    const invalid = kit.prestige("invalid", {
      scope: run,
      reward: prestige.reward,
      manifest: prestige.manifest,
      canReset: () => true,
      rewardFor: () => 0,
    });
    expect(game.dispatch(prestigeCommand(invalid))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "no-reward" },
    });
    const other = fixture();
    expect(() =>
      kit.prestige("foreign", {
        scope: run,
        reward: prestige.reward,
        manifest: { clear: [other.run] },
        canReset: () => true,
        rewardFor: () => 1,
      }),
    ).toThrow("another game kit");
    const badRetention = kit.prestige("bad-retention", {
      scope: run,
      reward: prestige.reward,
      manifest: { clear: [run], retain: { resources: [stars] } },
      canReset: () => true,
      rewardFor: () => 1,
    });
    expect(game.dispatch(prestigeCommand(badRetention))).toMatchObject({
      ok: false,
      error: { code: "transaction-failed" },
    });
    expect(
      game.dispatch({
        id: "foreign-retention",
        execute: (tx) => tx.reset({ clear: [run], retain: { resources: [other.points] } }),
      }),
    ).toEqual({ ok: false, error: { code: "invalid-target", id: "run" } });
  });

  it("clears and retains scoped progression state and restarts automation schedules", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const account = kit.scope("account");
    const points = kit.resource("points", { scope: run, initial: 0 });
    const stars = kit.resource("stars", { scope: account, initial: 0 });
    const keptUpgrade = kit.upgrade("kept-upgrade", {
      scope: run,
      costs: [],
      prerequisiteIds: [],
      unlocked: () => true,
    });
    const clearedUpgrade = kit.upgrade("cleared-upgrade", {
      scope: run,
      costs: [],
      prerequisiteIds: [],
      unlocked: () => true,
    });
    const milestone = kit.milestone("kept-milestone", {
      scope: run,
      when: (state) => state.get(points) >= 100,
    });
    const achievement = kit.achievement("cleared-achievement", {
      scope: run,
      when: (state) => state.get(points) >= 100,
    });
    const keptChallenge = kit.challenge("kept-challenge", {
      scope: run,
      compatibleGroup: "combined",
      maxCompletions: 1,
      enterReset: { clear: [] },
      exitReset: { clear: [] },
      canEnter: () => true,
      completionsEarned: () => 1,
    });
    const clearedChallenge = kit.challenge("cleared-challenge", {
      scope: run,
      compatibleGroup: "combined",
      maxCompletions: 1,
      enterReset: { clear: [] },
      exitReset: { clear: [] },
      canEnter: () => true,
      completionsEarned: () => 1,
    });
    const automationOptions = {
      scope: run,
      cadenceMs: 500,
      initiallyEnabled: false,
      unlocked: () => true,
      condition: () => false,
      action: () => ({ id: "unused", execute: () => undefined }),
    };
    const keptAutomation = kit.automation("kept-auto", automationOptions);
    const clearedAutomation = kit.automation("cleared-auto", automationOptions);
    const prestige = kit.prestige("reset", {
      scope: run,
      reward: stars,
      manifest: {
        clear: [run],
        retain: {
          upgrades: [keptUpgrade],
          triggers: [milestone],
          challenges: [keptChallenge],
          automation: [keptAutomation],
        },
      },
      canReset: (state) => state.get(points) >= 100,
      rewardFor: () => 1,
    });
    const challenges = [keptChallenge, clearedChallenge];
    const game = createGame(
      kit.defineGame({
        id: "progression-reset",
        simulationVersion: 1,
        stepMs: 100,
        resources: [points, stars],
        upgrades: [keptUpgrade, clearedUpgrade],
        triggers: [milestone, achievement],
        challenges,
        automation: [keptAutomation, clearedAutomation],
        prestiges: [prestige],
      }),
    );
    game.dispatch({ id: "seed", execute: (transaction) => transaction.set(points, 100) });
    game.dispatch(upgradeCommand(keptUpgrade));
    game.dispatch(upgradeCommand(clearedUpgrade));
    for (const challenge of challenges) {
      game.dispatch(enterChallengeCommand(challenge, challenges));
      game.dispatch(completeChallengeCommand(challenge));
    }
    game.dispatch(automationCommand(keptAutomation, true));
    game.dispatch(automationCommand(clearedAutomation, true));
    game.advance(200);
    game.dispatch(prestigeCommand(prestige));

    const progression = game.getSnapshot().progression;
    expect(progression.upgrades).toEqual({ "kept-upgrade": true });
    expect(progression.milestones).toEqual({ "kept-milestone": true });
    expect(progression.achievements).toEqual({});
    expect(progression.activeChallenges).toEqual(["kept-challenge"]);
    expect(progression.challengeCompletions).toEqual({ "kept-challenge": 1 });
    expect(progression.automation["kept-auto"]).toEqual({ enabled: true, nextRunMs: 500 });
    expect(progression.automation["cleared-auto"]).toEqual({ enabled: false, nextRunMs: 700 });
  });
});
