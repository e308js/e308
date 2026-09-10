import { createGame } from "@e308/core";
import { goalPolicy, rankedPolicy, runHarness } from "@e308/core/testing";
import {
  cascadeBuyables,
  cascadeDefinition,
  cascadeKit,
  cascadeResources,
  cascadeScenario,
  cascadeTiers,
} from "@e308/game-cascade";
import { driveScenario } from "./finished-games.js";

const limits = {
  maximumDecisions: 5_000,
  maximumTraceEntries: 5_000,
  maximumSamples: 200,
  sampleCadenceMs: 60_000,
} as const;

export function cascadeCompletion(strategy: "reset-first" | "depth-first", botSeed: string) {
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

export function cascadeShortcutCompletion() {
  const base = cascadeScenario("reset-first");
  const scenario = {
    ...base,
    create: () => {
      const game = createGame(cascadeDefinition);
      game.dispatch({
        id: "pre-collapse-shortcut-checkpoint",
        execute: (transaction) => {
          transaction.set(cascadeResources.currency, cascadeKit.q("1e30"));
          cascadeBuyables.forEach((buyable, index) => {
            transaction.setPurchase(buyable.id, cascadeKit.q(10));
            transaction.set(cascadeTiers[index] as (typeof cascadeTiers)[number], cascadeKit.q(10));
          });
        },
      });
      return game;
    },
    goals: [
      {
        id: "shortcut-probe",
        evaluate: () => ({ kind: "pending" as const, constraints: [] }),
      },
    ],
  };
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
    goalId: "shortcut-probe",
    schedule: [{ kind: "active", durationMs: 250 }],
    decisionCadenceMs: 250,
    maximumImmediateActions: 3,
    actionSpace: "complete",
    gameSeed: "aa",
    botSeed: "03",
    limits: { ...limits, maximumDecisions: 3 },
    replayCommand: "pnpm replay:game cascade shortcut",
  });
}

export function cascadeChallengePacingCompletion() {
  return runHarness({
    scenario: cascadeScenario("reset-first"),
    policy: rankedPolicy({ id: "cascade-player-cadence", version: "1" }),
    goalId: "final-research",
    schedule: [{ kind: "active", durationMs: 72 * 60 * 60_000 }],
    decisionCadenceMs: 250,
    maximumImmediateActions: 64,
    gameSeed: "aa",
    botSeed: "04",
    limits: { ...limits, maximumDecisions: 50_000 },
    replayCommand: "pnpm replay:game cascade player-cadence",
  });
}

export function playCascade(strategy: "reset-first" | "depth-first") {
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
