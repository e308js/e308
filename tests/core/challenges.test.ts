import { describe, expect, it } from "vitest";
import {
  challengeCountsAs,
  completeChallengeCommand,
  createGame,
  createGameKit,
  enterChallengeCommand,
  exitChallengeCommand,
  nativeNumbers,
  type ProgressionContext,
  type Transaction,
} from "../../packages/core/src/index.js";

function fixture() {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("run");
  const challenges = kit.scope("challenges");
  const points = kit.resource("points", { scope: run, initial: 0 });
  const medals = kit.resource("medals", { scope: challenges, initial: 0 });
  const common = {
    scope: challenges,
    compatibleGroup: "normal",
    maxCompletions: 3,
    enterReset: { clear: [run] },
    exitReset: { clear: [run] },
    canEnter: () => true,
    completionsEarned: (state: ProgressionContext<number>) => {
      state.isChallengeActive("scarcity");
      state.challengeCompletions("scarcity");
      return Math.min(3, Math.floor(state.get(points) / 10));
    },
    grantReward: (tx: Transaction<number>, tier: number) => tx.add(medals, tier),
  } as const;
  const scarcity = kit.challenge("scarcity", {
    ...common,
    countsAs: ["slow"],
    replacementKeys: ["production"],
  });
  const noBuy = kit.challenge("no-buy", { ...common, replacementKeys: ["purchases"] });
  const conflict = kit.challenge("conflict", { ...common, replacementKeys: ["production"] });
  const exclusive = kit.challenge("exclusive", {
    scope: common.scope,
    maxCompletions: common.maxCompletions,
    enterReset: common.enterReset,
    exitReset: common.exitReset,
    canEnter: common.canEnter,
    completionsEarned: common.completionsEarned,
    grantReward: common.grantReward,
  });
  const catalog = [scarcity, noBuy, conflict, exclusive];
  const game = createGame(
    kit.defineGame({
      id: "challenge-test",
      simulationVersion: 1,
      stepMs: 50,
      resources: [points, medals],
      challenges: catalog,
    }),
  );
  return { game, points, medals, scarcity, noBuy, conflict, exclusive, catalog };
}

describe("challenges", () => {
  it("combines compatible rules, exposes countsAs membership, and rejects conflicts", () => {
    const { game, scarcity, noBuy, conflict, exclusive, catalog } = fixture();
    game.dispatch(enterChallengeCommand(scarcity, catalog));
    game.dispatch(enterChallengeCommand(noBuy, catalog));
    expect(game.getSnapshot().progression.activeChallenges).toEqual(["no-buy", "scarcity"]);
    let countsAs = false;
    game.dispatch({
      id: "inspect-membership",
      execute: (tx) => {
        countsAs = challengeCountsAs(tx, catalog, "slow");
      },
    });
    expect(countsAs).toBe(true);
    expect(game.dispatch(enterChallengeCommand(conflict, catalog))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "conflict" },
    });
    expect(game.dispatch(enterChallengeCommand(exclusive, catalog))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "conflict" },
    });
  });

  it("grants bulk tiers once and keeps a permanent reward ledger across retry", () => {
    const { game, points, scarcity, catalog } = fixture();
    game.dispatch(enterChallengeCommand(scarcity, catalog));
    game.dispatch({ id: "progress", execute: (tx) => tx.set(points, 35) });
    expect(game.dispatch(completeChallengeCommand(scarcity)).ok).toBe(true);
    expect(game.getSnapshot().progression).toMatchObject({
      challengeCompletions: { scarcity: 3 },
      rewardLedger: ["challenge:scarcity:1", "challenge:scarcity:2", "challenge:scarcity:3"],
    });
    expect(game.getSnapshot().resources.medals).toBe(6);
    expect(game.dispatch(completeChallengeCommand(scarcity))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "no-new-tier" },
    });
    game.dispatch(exitChallengeCommand(scarcity));
    game.dispatch(enterChallengeCommand(scarcity, catalog));
    game.dispatch({ id: "progress-again", execute: (tx) => tx.set(points, 35) });
    expect(game.dispatch(completeChallengeCommand(scarcity))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "no-new-tier" },
    });
    expect(game.getSnapshot().resources.medals).toBe(6);
  });

  it("validates lifecycle state and completion tiers", () => {
    const { game, scarcity, catalog } = fixture();
    expect(game.dispatch(exitChallengeCommand(scarcity))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "not-active" },
    });
    game.dispatch(enterChallengeCommand(scarcity, catalog));
    expect(game.dispatch(enterChallengeCommand(scarcity, catalog))).toMatchObject({
      ok: false,
      error: { code: "disabled", reasonKey: "already-active" },
    });
  });
});
