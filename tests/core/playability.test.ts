import {
  createGame,
  createGameKit,
  nativeNumbers,
  prestigeCommand,
  type Snapshot,
} from "@e308/core";
import { describe, expect, it } from "vitest";
import {
  assessPlayability,
  type HarnessRunOptions,
  type PlayabilityPressure,
  type PressureRelief,
  rankedPolicy,
  runHarness,
} from "../../packages/core/src/testing/index.js";
import {
  baseHarnessParameters,
  type HarnessIntent,
  type HarnessObservation,
  harnessScenario,
} from "../helpers/harness-fixture.js";

function options(
  scenario: HarnessRunOptions<number, HarnessObservation, HarnessIntent>["scenario"],
  durationMs = 1_000,
): HarnessRunOptions<number, HarnessObservation, HarnessIntent> {
  return {
    scenario,
    policy: rankedPolicy({ version: "1" }),
    gameSeed: "00",
    botSeed: "01",
    goalId: "tokens",
    decisionCadenceMs: 1_000,
    schedule: [{ kind: "idle-open", durationMs }],
    limits: {
      maximumDecisions: 10,
      maximumTraceEntries: 10,
      maximumSamples: 10,
      sampleCadenceMs: 1_000,
    },
    replayCommand: "pnpm test playability",
  };
}

describe("playability pressures", () => {
  it("identifies action loops paced by a slow canonical step", () => {
    const scenario = harnessScenario({ ...baseHarnessParameters, cost: 0, target: 20 });
    const report = runHarness({
      ...options(scenario, 1_000),
      decisionCadenceMs: 100,
      schedule: [{ kind: "active", durationMs: 1_000 }],
    });
    expect(report.playability.actionCadence).toMatchObject({
      positiveIntervals: 9,
      oneStepIntervals: 9,
      oneStepFraction: 1,
    });
    expect(
      assessPlayability(report, {
        maximumNoReliefMs: 1_000,
        maximumTickBoundStepMs: 50,
        minimumTickBoundIntervals: 5,
      }),
    ).toEqual([expect.objectContaining({ code: "slow-tick-action-loop", severity: "p1" })]);
  });

  it("separates immediate actions, investments, and passive progress", () => {
    const base = harnessScenario({ ...baseHarnessParameters, cost: 0, target: 20 });
    const report = runHarness(
      options({
        ...base,
        pressures: () => [
          pressure("action", [{ kind: "action", actionId: "buy-token" }]),
          pressure("investment", [
            { kind: "investment", actionId: "buy-token", estimatedMs: 5_000 },
          ]),
          pressure("passive", [{ kind: "passive", estimatedMs: 8_000 }]),
          { ...pressure("inactive", []), active: false },
        ],
      }),
    );
    expect(report.playability.pressures.action?.actionableMs).toBe(1_000);
    expect(report.playability.pressures.investment).toMatchObject({
      savingMs: 1_000,
      maximumPassiveEstimateMs: 5_000,
    });
    expect(report.playability.pressures.passive).toMatchObject({
      passiveMs: 1_000,
      maximumPassiveEstimateMs: 8_000,
    });
    expect(report.playability.pressures.inactive).toBeUndefined();
  });

  it("tracks separate no-relief episodes and reports resolved pressure", () => {
    const base = harnessScenario({ ...baseHarnessParameters, target: 20 });
    const report = runHarness(
      options(
        {
          ...base,
          pressures: (snapshot) => [
            { ...pressure("intermittent", []), active: snapshot.gameTimeMs !== 1_000 },
          ],
        },
        3_000,
      ),
    );
    expect(report.playability.pressures.intermittent).toMatchObject({
      currentlyActive: true,
      observedMs: 2_000,
      longestNoReliefMs: 1_000,
    });
    const metric = report.playability.pressures.intermittent;
    if (!metric) throw new TypeError("intermittent pressure missing");
    const resolved = {
      ...report,
      playability: {
        ...report.playability,
        pressures: {
          intermittent: {
            ...metric,
            currentlyActive: false,
          },
        },
      },
    };
    expect(assessPlayability(resolved, { maximumNoReliefMs: 500 })).toEqual([
      expect.objectContaining({ code: "sustained-no-relief", severity: "p1" }),
    ]);
  });

  it("reports instant, brief, and low-interaction challenge episodes", () => {
    const report = runHarness(options(harnessScenario(baseHarnessParameters)));
    const challenged = {
      ...report,
      playability: {
        ...report.playability,
        progression: {
          ...report.playability.progression,
          challengeEpisodes: [
            challengeEpisode("instant", 0, 1),
            challengeEpisode("brief", 5_000, 2),
          ],
        },
      },
    };
    expect(
      assessPlayability(challenged, {
        maximumNoReliefMs: 10_000,
        minimumChallengeDurationMs: 10_000,
        minimumChallengeActions: 3,
      }).map((finding) => finding.code),
    ).toEqual([
      "instant-challenge",
      "low-interaction-challenge",
      "brief-challenge",
      "low-interaction-challenge",
    ]);
  });

  it("reports reset layers crossed without simulated time between them", () => {
    const kit = createGameKit({ numbers: nativeNumbers });
    const run = kit.scope("run");
    const permanent = kit.scope("permanent");
    const points = kit.resource("points", { scope: run, initial: 1 });
    const resets = kit.resource("resets", { scope: permanent, initial: 0 });
    const resetLayer = kit.prestige("reset-layer", {
      scope: permanent,
      reward: resets,
      manifest: { clear: [run] },
      canReset: () => true,
      rewardFor: () => 1,
    });
    const definition = kit.defineGame({
      id: "compressed-resets",
      simulationVersion: 1,
      stepMs: 100,
      resources: [points, resets],
      prestiges: [resetLayer],
    });
    const scenario = {
      ...harnessScenario(baseHarnessParameters),
      id: "compressed-resets",
      definition,
      create: () => createGame(definition),
      goals: [
        {
          id: "tokens",
          evaluate: (snapshot: Snapshot<number>) =>
            (snapshot.resources.resets ?? 0) >= 3
              ? ({ kind: "reached" } as const)
              : ({ kind: "pending", constraints: [] } as const),
        },
      ],
      quote: (snapshot: Snapshot<number>) => [
        {
          id: "reset",
          revision: snapshot.revision.toString(),
          intent: { kind: "buy-token" as const },
          legal: true,
          useful: true,
          effects: ["progression-reset" as const],
          constraints: [],
        },
      ],
      command: () => prestigeCommand(resetLayer),
      milestones: () => [],
      diagnostics: () => ({ overflow: 0, resetRecoveries: 0, taskBlocks: 0 }),
    };
    const compressed = runHarness({
      ...options(scenario),
      maximumImmediateActions: 8,
      schedule: [{ kind: "active", durationMs: 1_000 }],
    });
    expect(compressed.playability.progression).toEqual({
      resetTransitions: 3,
      maximumResetTransitionsAtSameGameTime: 3,
      challengeEpisodes: [],
    });
    expect(
      assessPlayability(compressed, {
        maximumNoReliefMs: 10_000,
        maximumResetTransitionsAtSameGameTime: 1,
      }),
    ).toEqual([expect.objectContaining({ code: "compressed-reset-chain", severity: "p1" })]);
  });

  it("rejects duplicate ids and changing pressure kinds", () => {
    const base = harnessScenario({ ...baseHarnessParameters, target: 20 });
    expect(() =>
      runHarness(
        options({ ...base, pressures: () => [pressure("same", []), pressure("same", [])] }),
      ),
    ).toThrow("Duplicate pressure id");
    expect(() =>
      runHarness(
        options(
          {
            ...base,
            pressures: (snapshot) => [
              {
                ...pressure("changing", []),
                kind: snapshot.gameTimeMs === 0 ? "capacity" : "throughput",
              },
            ],
          },
          2_000,
        ),
      ),
    ).toThrow("Pressure kind changed");
  });

  it("validates pressure identifiers and relief estimates", () => {
    const base = harnessScenario({ ...baseHarnessParameters, target: 20 });
    expect(() => runHarness(options({ ...base, pressures: () => [pressure("", [])] }))).toThrow(
      "id and detail",
    );
    expect(() =>
      runHarness(
        options({
          ...base,
          pressures: () => [pressure("bad-action", [{ kind: "action", actionId: "" }])],
        }),
      ),
    ).toThrow("action id");
    expect(() =>
      runHarness(
        options({
          ...base,
          pressures: () => [
            pressure("bad-estimate", [{ kind: "passive", estimatedMs: Number.NaN }]),
          ],
        }),
      ),
    ).toThrow("finite and non-negative");
    expect(() =>
      runHarness(
        options({
          ...base,
          pressures: () => [
            pressure("bad-investment", [{ kind: "investment", actionId: "", estimatedMs: 1_000 }]),
          ],
        }),
      ),
    ).toThrow("investment action id");
  });

  it("keeps an observed policy stall separate from a proven deadlock", () => {
    const scenario = harnessScenario({ ...baseHarnessParameters, rate: 0, target: 20 });
    const report = runHarness(options(scenario));
    expect(report.outcome).toEqual({ kind: "unreached", reason: "observed-stall" });
    expect(assessPlayability(report, { maximumNoReliefMs: 0 })).toEqual([]);
  });
});

function pressure(id: string, relief: readonly PressureRelief[]): PlayabilityPressure {
  return { id, kind: "capacity", active: true, detail: `${id} pressure`, relief };
}

function challengeEpisode(challengeId: string, gameDurationMs: number, successfulActions: number) {
  return {
    challengeId,
    enteredAtRealMs: 0,
    enteredAtGameMs: 0,
    completedAtRealMs: gameDurationMs,
    completedAtGameMs: gameDurationMs,
    realDurationMs: gameDurationMs,
    gameDurationMs,
    activeDurationMs: gameDurationMs,
    successfulActions,
    completionGain: "1",
  };
}
