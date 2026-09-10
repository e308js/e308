import {
  completeChallengeCommand,
  createGame,
  type EternityQuantity,
  enterChallengeCommand,
  eternityNumbers,
} from "@e308/core";
import { assessPlayability, goalPolicy, rankedPolicy, runHarness } from "@e308/core/testing";
import {
  cascadeBuyables,
  cascadeChallenges,
  cascadeDefinition,
  cascadeKit,
  cascadeResources,
  cascadeScenario,
  cascadeTiers,
  cascadeView,
  createCascade,
  encoded,
  importCascade,
  purchasedTierMultiplier,
} from "@e308/game-cascade";
import { describe, expect, it } from "vitest";
import { driveScenario } from "../helpers/finished-games.js";

const limits = {
  maximumDecisions: 5_000,
  maximumTraceEntries: 5_000,
  maximumSamples: 200,
  sampleCadenceMs: 60_000,
} as const;

describe("finished Cascade", () => {
  it("matches an independent delayed eight-tier integer recurrence", () => {
    const game = createGame(cascadeDefinition);
    game.dispatch({
      id: "recurrence-fixture",
      execute(transaction) {
        transaction.set(cascadeResources.currency, cascadeKit.q(0));
        transaction.set(cascadeTiers[7] as (typeof cascadeTiers)[number], cascadeKit.q(1));
      },
    });
    const tiers = Array<bigint>(8).fill(0n);
    tiers[7] = 1n;
    let currency = 0n;
    for (let step = 0; step < 24; step += 1) {
      const start = [...tiers];
      currency += start[0] as bigint;
      for (let index = 1; index < 8; index += 1)
        tiers[index - 1] = (tiers[index - 1] as bigint) + (start[index] as bigint);
    }
    expect(game.advance(24_000).ok).toBe(true);
    expect(encoded(game.getSnapshot().resources.currency as EternityQuantity)).toBe(
      String(currency),
    );
    expect(
      cascadeTiers.map((tier) =>
        encoded(game.getSnapshot().resources[tier.id] as EternityQuantity),
      ),
    ).toEqual(tiers.map(String));
  });

  it("keeps purchased amounts distinct and grants every buy-ten milestone", () => {
    const cascade = createCascade();
    cascade.game.dispatch({
      id: "purchase-fixture",
      execute: (transaction) => transaction.set(cascadeResources.currency, cascadeKit.q("1e30")),
    });
    for (let tier = 1; tier <= 8; tier += 1)
      expect(cascade.dispatch({ type: "buy", tier, count: 10 }).ok).toBe(true);
    const snapshot = cascade.getSnapshot();
    const topBuyable = cascadeBuyables[7];
    const topTier = cascadeTiers[7];
    if (!topBuyable || !topTier) throw new TypeError("Cascade top tier is missing");
    expect(Object.keys(snapshot.progression.milestones)).toHaveLength(8);
    expect(encoded(snapshot.purchaseCounts[topBuyable.id] as EternityQuantity)).toBe("10");
    expect(
      eternityNumbers.cmp(
        snapshot.resources[topTier.id] as EternityQuantity,
        snapshot.purchaseCounts[topBuyable.id] as EternityQuantity,
      ),
    ).toBe(0);
  });

  it("requires the full eight-tier route before the first reset", () => {
    const cascade = createCascade();
    cascade.game.dispatch({
      id: "early-collapse-fixture",
      execute: (transaction) => transaction.set(cascadeResources.currency, cascadeKit.q("1e30")),
    });
    expect(cascade.dispatch({ type: "prestige", id: "collapse" })).toMatchObject({
      ok: false,
      error: { code: "locked" },
    });
    for (let tier = 1; tier <= 8; tier += 1)
      expect(cascade.dispatch({ type: "buy", tier, count: 10 }).ok).toBe(true);
    expect(cascade.dispatch({ type: "prestige", id: "collapse" }).ok).toBe(true);
    expect(
      eternityNumbers.cmp(
        cascade.getSnapshot().resources["infinity-points"] as EternityQuantity,
        cascadeKit.q(0),
      ),
    ).toBeGreaterThan(0);
    expect(
      eternityNumbers.cmp(
        cascade.getSnapshot().resources["infinity-points"] as EternityQuantity,
        cascadeKit.q(100),
      ),
    ).toBeLessThan(0);
    expect(
      encoded(cascade.getSnapshot().resources["prestige-multiplier"] as EternityQuantity),
    ).toBe(
      encoded(
        eternityNumbers.add(
          cascadeKit.q(1),
          cascade.getSnapshot().resources["infinity-points"] as EternityQuantity,
        ),
      ),
    );
  });

  it("updates one prestige multiplier and applies it to the producer cascade", () => {
    const producedWith = (multiplier: number) => {
      const game = createGame(cascadeDefinition);
      game.dispatch({
        id: "reset-multiplier-fixture",
        execute(transaction) {
          transaction.set(cascadeResources.currency, cascadeKit.q(0));
          transaction.set(cascadeTiers[0] as (typeof cascadeTiers)[number], cascadeKit.q(1));
          transaction.set(cascadeResources.prestigeMultiplier, cascadeKit.q(multiplier));
        },
      });
      game.advance(1_000);
      return Number(encoded(game.getSnapshot().resources.currency as EternityQuantity));
    };
    expect(producedWith(3)).toBe(producedWith(1) * 3);

    const condenseGame = createCascade();
    condenseGame.game.dispatch({
      id: "condense-multiplier-fixture",
      execute: (transaction) => transaction.set(cascadeResources.infinity, cascadeKit.q(100)),
    });
    expect(condenseGame.dispatch({ type: "prestige", id: "condense" }).ok).toBe(true);
    expect(
      encoded(condenseGame.getSnapshot().resources["prestige-multiplier"] as EternityQuantity),
    ).toBe("404");

    const ascendGame = createCascade();
    ascendGame.game.dispatch({
      id: "ascend-multiplier-fixture",
      execute: (transaction) => {
        transaction.set(cascadeResources.cores, cascadeKit.q(3));
        for (const challenge of cascadeChallenges)
          transaction.setChallengeCompletions(challenge.id, cascadeKit.q(1));
      },
    });
    expect(ascendGame.dispatch({ type: "prestige", id: "ascend" }).ok).toBe(true);
    expect(
      encoded(ascendGame.getSnapshot().resources["prestige-multiplier"] as EternityQuantity),
    ).toBe("10");
  });

  it("scales each tier from its own purchased-generator thresholds", () => {
    expect(encoded(purchasedTierMultiplier(cascadeKit.q(9)))).toBe("1");
    expect(encoded(purchasedTierMultiplier(cascadeKit.q(10)))).toBe("2");
    expect(encoded(purchasedTierMultiplier(cascadeKit.q(20)))).toBe("4");

    const game = createGame(cascadeDefinition);
    game.dispatch({
      id: "tier-multiplier-fixture",
      execute(transaction) {
        transaction.set(cascadeResources.currency, cascadeKit.q(0));
        transaction.set(cascadeTiers[0] as (typeof cascadeTiers)[number], cascadeKit.q(10));
        transaction.set(cascadeTiers[1] as (typeof cascadeTiers)[number], cascadeKit.q(10));
        transaction.setPurchase("dimension-1", cascadeKit.q(20));
        transaction.setPurchase("dimension-2", cascadeKit.q(10));
      },
    });
    game.advance(1_000);
    const snapshot = game.getSnapshot();
    expect(encoded(snapshot.resources.currency as EternityQuantity)).toBe("40");
    expect(encoded(snapshot.resources["tier-1"] as EternityQuantity)).toBe("30");
  });

  it("completes all reset levels and challenges through quote-only play", () => {
    const { game, actions } = play("reset-first");
    const snapshot = game.getSnapshot();
    expect(snapshot.progression.won).toBe(true);
    expect(Object.keys(snapshot.progression.challengeCompletions)).toHaveLength(6);
    expect(
      encoded(snapshot.progression.challengeCompletions["slow-foundation"] as EternityQuantity),
    ).toBe("3");
    expect(
      eternityNumbers.cmp(
        snapshot.resources.singularity as EternityQuantity,
        eternityNumbers.fromString("1e308"),
      ),
    ).toBeGreaterThan(0);
    expect(actions.indexOf("challenge-enter:scarce-purchases")).toBeLessThan(
      actions.indexOf("challenge-enter:automation-drought"),
    );
    expect(snapshot.resources.respecs).toBeDefined();
  }, 30_000);

  it("produces different truthful pacing for depth and reset strategies", () => {
    const reset = completion("reset-first", "01");
    const depth = completion("depth-first", "02");
    const shortcut = shortcutCompletion();
    expect(reset.outcome.kind).toBe("reached");
    expect(depth.outcome.kind).toBe("reached");
    expect(shortcut.outcome.kind).toBe("reached");
    if (reset.outcome.kind !== "reached" || depth.outcome.kind !== "reached") return;
    expect(depth.outcome.atGameMs).toBeLessThanOrEqual(72 * 60 * 60_000);
    expect(reset.milestones["dimension-1-ten"]?.gameTimeMs).not.toBe(
      depth.milestones["dimension-1-ten"]?.gameTimeMs,
    );
    expect(depth.milestones["dimension-8-ten"]?.gameTimeMs).toBeLessThan(
      reset.milestones["dimension-8-ten"]?.gameTimeMs ?? Number.POSITIVE_INFINITY,
    );
    expect(Object.keys(reset.milestones)).toEqual(
      expect.arrayContaining(["challenge:composite-trial", "ascended", "ending"]),
    );
    expect(
      assessPlayability(shortcut, {
        maximumNoReliefMs: 10 * 60_000,
        maximumResetTransitionsAtSameGameTime: 2,
      }),
    ).toEqual([]);
  }, 30_000);

  it("round-trips the above-1e308 ending and renders its dense progression view", () => {
    const played = play("reset-first").game.getSnapshot();
    const wrapped = createCascade(played);
    const restored = importCascade(wrapped.exportSave(2_000_000));
    expect(restored.getSnapshot()).toEqual(played);
    const view = cascadeView(restored.getSnapshot());
    expect(JSON.stringify(view)).toContain("progression-tree");
    expect(JSON.stringify(view)).toContain("challenge-grid");
  }, 30_000);

  it("explains challenge rules, exposes exit, and shows final prerequisites", () => {
    const cascade = createCascade();
    cascade.game.dispatch({
      id: "challenge-view-fixture",
      execute: (transaction) => transaction.set(cascadeResources.infinity, cascadeKit.q(1)),
    });
    expect(cascade.dispatch({ type: "challenge-enter", id: "slow-foundation" }).ok).toBe(true);
    const rendered = JSON.stringify(cascadeView(cascade.getSnapshot()));
    expect(rendered).toContain("All production runs at 25% speed");
    expect(rendered).toContain("challenge-exit:slow-foundation");
    expect(rendered).toContain("10 generators in all 8 tiers");
    expect(rendered).toContain("infinity yield research");
  });

  it("rejects invalid dimensions and challenge IDs without mutation", () => {
    const cascade = createCascade();
    const before = cascade.getSnapshot();
    expect(cascade.dispatch({ type: "buy", tier: 99, count: 1 })).toMatchObject({
      ok: false,
      error: { code: "invalid-target" },
    });
    expect(cascade.getSnapshot()).toBe(before);
    expect(cascade.dispatch({ type: "challenge-enter", id: "missing" })).toMatchObject({
      ok: false,
      error: { code: "invalid-target" },
    });
  });

  it("covers low and middle challenge tiers plus both automation targets", () => {
    const seeded = createGame(cascadeDefinition);
    seeded.dispatch({
      id: "challenge-fixture",
      execute: (transaction) => {
        transaction.set(cascadeResources.infinity, cascadeKit.q(2));
        transaction.set(cascadeResources.currency, cascadeKit.q(0));
      },
    });
    const reversed = cascadeChallenges[1];
    if (!reversed) throw new TypeError("reversed challenge fixture missing");
    expect(seeded.dispatch(enterChallengeCommand(reversed, cascadeChallenges)).ok).toBe(true);
    expect(seeded.dispatch(completeChallengeCommand(reversed)).ok).toBe(false);
    expect(
      createCascade(seeded.getSnapshot()).dispatch({
        type: "automation",
        id: "collapse",
        enabled: true,
      }).ok,
    ).toBe(true);

    const middle = createGame(cascadeDefinition);
    middle.dispatch({
      id: "middle-tier-fixture",
      execute: (transaction) => {
        transaction.set(cascadeResources.infinity, cascadeKit.q(2));
      },
    });
    const wrapped = createCascade(middle.getSnapshot());
    expect(wrapped.dispatch({ type: "challenge-enter", id: "slow-foundation" }).ok).toBe(true);
    wrapped.game.dispatch({
      id: "challenge-progress-fixture",
      execute: (transaction) => transaction.set(cascadeResources.currency, cascadeKit.q("1e9")),
    });
    expect(wrapped.dispatch({ type: "challenge-complete", id: "slow-foundation" }).ok).toBe(true);
    expect(
      encoded(
        wrapped.getSnapshot().progression.challengeCompletions[
          "slow-foundation"
        ] as EternityQuantity,
      ),
    ).toBe("2");
    expect(encoded(wrapped.getSnapshot().resources["research-points"] as EternityQuantity)).toBe(
      "2",
    );
  });

  it("exposes the complete headless action surface for exploratory policies", () => {
    const scenario = cascadeScenario();
    const snapshot = scenario.create("aa").getSnapshot();
    const quotes = scenario.quoteAll?.(snapshot);
    expect(quotes).toBeDefined();
    expect(quotes?.map((quote) => quote.id)).toEqual(
      expect.arrayContaining([
        "buy-tier-1",
        "buy-group-tier-1",
        "buy-tier-8",
        "collapse",
        "condense",
        "ascend",
        "enter-slow-foundation",
        "complete-composite-trial",
        "enable-dimension-auto",
        "allocate-speed",
        "final-research",
      ]),
    );
    expect(quotes?.find((quote) => quote.id === "buy-tier-1")?.legal).toBe(true);
    expect(quotes?.find((quote) => quote.id === "ascend")?.legal).toBe(false);
  });

  it("applies challenge rules and blocks automation during its drought", () => {
    const challenged = createCascade();
    challenged.game.dispatch({
      id: "challenge-rules-fixture",
      execute: (transaction) => transaction.set(cascadeResources.infinity, cascadeKit.q(2)),
    });
    expect(challenged.dispatch({ type: "challenge-enter", id: "reversed-emphasis" }).ok).toBe(true);
    challenged.game.dispatch({
      id: "reversed-production-fixture",
      execute: (transaction) => {
        transaction.set(cascadeResources.currency, cascadeKit.q(0));
        transaction.set(cascadeTiers[7] as (typeof cascadeTiers)[number], cascadeKit.q(128));
      },
    });
    challenged.dispatch({ type: "advance", milliseconds: 1_000 });
    expect(encoded(challenged.getSnapshot().resources["tier-7"] as EternityQuantity)).toBe("1");

    expect(challenged.dispatch({ type: "challenge-exit", id: "reversed-emphasis" }).ok).toBe(true);
    expect(challenged.dispatch({ type: "challenge-enter", id: "automation-drought" }).ok).toBe(
      true,
    );
    expect(
      challenged.dispatch({ type: "automation", id: "dimension", enabled: true }),
    ).toMatchObject({ ok: false, error: { code: "locked" } });
  });
});

function completion(strategy: "reset-first" | "depth-first", botSeed: string) {
  return runHarness({
    scenario: cascadeScenario(strategy),
    policy: rankedPolicy({ id: `cascade-${strategy}`, version: "1" }),
    goalId: "final-research",
    schedule: [{ kind: "active", durationMs: 72 * 60 * 60_000 }],
    decisionCadenceMs: 60_000,
    gameSeed: "aa",
    botSeed,
    limits,
    replayCommand: `pnpm replay:game cascade ${strategy}`,
  });
}

function shortcutCompletion() {
  const scenario = cascadeScenario("reset-first");
  return runHarness({
    scenario,
    policy: goalPolicy({
      id: "cascade-shortcut-seeker",
      version: "1",
      includeAllLegal: true,
      score: (_context, quote) => {
        if (quote.id === "ascend") return 10_000;
        if (quote.id === "condense") return 9_000;
        if (quote.id === "collapse") return 8_000;
        return quote.useful ? (quote.rank ?? 0) : Number.NEGATIVE_INFINITY;
      },
    }),
    goalId: "final-research",
    schedule: [{ kind: "active", durationMs: 72 * 60 * 60_000 }],
    decisionCadenceMs: 60_000,
    actionSpace: "complete",
    gameSeed: "aa",
    botSeed: "03",
    limits,
    replayCommand: "pnpm replay:game cascade shortcut",
  });
}

function play(strategy: "reset-first" | "depth-first") {
  const scenario = cascadeScenario(strategy);
  const actions: string[] = [];
  const game = driveScenario(scenario, {
    cadenceMs: 60_000,
    maximumDecisions: 5_000,
    stop: (snapshot) => snapshot.progression.won,
    actionLog: actions,
  });
  return { game, actions };
}
