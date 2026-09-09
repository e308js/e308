import { describe, expect, it } from "vitest";
import { compareBaseline, runSweep } from "../../packages/core/src/balance/index.js";
import {
  aggregateMarkdown,
  aggregateReports,
  distribution,
  goalPolicy,
  type HarnessReport,
  rankedPolicy,
  reportMarkdown,
  reportsJson,
  runHarness,
  scriptedPolicy,
} from "../../packages/core/src/testing/index.js";
import {
  baseHarnessParameters,
  type HarnessIntent,
  type HarnessObservation,
  harnessScenario,
} from "../helpers/harness-fixture.js";

const limits = {
  maximumDecisions: 20,
  maximumTraceEntries: 20,
  maximumSamples: 20,
  sampleCadenceMs: 1_000,
} as const;

function report(cost: number, version = "1.0.0") {
  return runHarness({
    scenario: harnessScenario({ ...baseHarnessParameters, cost }, version),
    policy: rankedPolicy<HarnessObservation, HarnessIntent>({ version: "1" }),
    gameSeed: "00",
    botSeed: "01",
    goalId: "tokens",
    decisionCadenceMs: 1_000,
    schedule: [{ kind: "active", durationMs: 10_000 }],
    limits,
    replayCommand: "replay",
  });
}

describe("pacing statistics and reports", () => {
  it("uses conditional nearest-rank distributions and retains unreached counts", () => {
    expect(distribution([])).toBeNull();
    expect(distribution([9, 1, 4, 2])).toEqual({
      count: 4,
      minimum: 1,
      mean: 4,
      p50: 2,
      p95: 9,
      maximum: 9,
    });
    const reached = report(2);
    const poor = runHarness({
      scenario: harnessScenario(baseHarnessParameters),
      policy: scriptedPolicy({ id: "poor", version: "1", actions: [] }),
      gameSeed: "00",
      botSeed: "01",
      goalId: "tokens",
      decisionCadenceMs: 1_000,
      schedule: [{ kind: "active", durationMs: 3_000 }],
      limits,
      replayCommand: "poor",
    });
    const barrier = runHarness({
      scenario: harnessScenario({ ...baseHarnessParameters, capacity: 1, certified: true }),
      policy: rankedPolicy({ version: "1" }),
      gameSeed: "00",
      botSeed: "01",
      goalId: "tokens",
      decisionCadenceMs: 1_000,
      schedule: [{ kind: "active", durationMs: 1_000 }],
      limits,
      replayCommand: "barrier",
    });
    const aggregate = aggregateReports([reached, poor, barrier]);
    expect(aggregate).toMatchObject({
      total: 3,
      reached: 1,
      completionRealMs: { count: 1, mean: 6_000 },
      unreached: { "policy-stall": 1, "certified-barrier": 1 },
    });
    expect(aggregateMarkdown(aggregate)).toContain("Runs: 3; reached: 1; unreached: 2");
    expect(reportsJson([reached])).toContain('"scenarioId": "harness-fixture"');
    expect(reportMarkdown(poor)).toContain("unreached: policy-stall");
    expect(reportMarkdown(barrier)).toContain("certified barrier");
    expect(aggregateMarkdown(aggregateReports([poor]))).toContain("none reached");
  });
});

describe("parameter sweeps", () => {
  it("crosses ordered cases, paired seeds, and policies while retaining invalid cases", () => {
    const policies = [
      rankedPolicy<HarnessObservation, HarnessIntent>({ version: "1" }),
      goalPolicy<HarnessObservation, HarnessIntent>({
        id: "goal",
        version: "1",
        score: (_context, quote) => quote.rank ?? 0,
      }),
    ];
    const results = runSweep({
      cases: [
        { id: "fast", parameters: { ...baseHarnessParameters, cost: 1 } },
        { id: "slow", parameters: { ...baseHarnessParameters, cost: 2 } },
        { id: "invalid", parameters: { ...baseHarnessParameters, cost: -1 } },
      ],
      seeds: [
        { gameSeed: "00", botSeed: "01" },
        { gameSeed: "02", botSeed: "03" },
      ],
      policies,
      createScenario: (parameters) => {
        if (parameters.cost < 0) throw new TypeError("negative cost");
        return harnessScenario(parameters);
      },
      goalId: "tokens",
      decisionCadenceMs: 1_000,
      schedule: [{ kind: "active", durationMs: 10_000 }],
      limits,
      replayCommand: (caseId, gameSeed, botSeed, policyId) =>
        `run ${caseId} ${gameSeed} ${botSeed} ${policyId}`,
    });
    expect(results.filter((result) => result.kind === "valid")).toHaveLength(8);
    expect(results.filter((result) => result.kind === "invalid")).toEqual([
      { kind: "invalid", caseId: "invalid", message: "negative cost" },
    ]);
    const keys = results
      .filter((result) => result.kind === "valid")
      .filter((result) => result.caseId === "fast")
      .map((result) => result.pairedKey);
    expect(new Set(keys).size).toBe(4);
    expect(() =>
      runSweep({
        cases: [],
        seeds: [{ gameSeed: "00", botSeed: "01" }],
        policies,
        createScenario: harnessScenario,
        goalId: "tokens",
        decisionCadenceMs: 1,
        schedule: [{ kind: "active", durationMs: 1 }],
        limits,
        replayCommand: () => "run",
      }),
    ).toThrow("cannot be empty");
    expect(() =>
      runSweep({
        cases: [
          { id: "same", parameters: baseHarnessParameters },
          { id: "same", parameters: baseHarnessParameters },
        ],
        seeds: [{ gameSeed: "00", botSeed: "01" }],
        policies,
        createScenario: harnessScenario,
        goalId: "tokens",
        decisionCadenceMs: 1,
        schedule: [{ kind: "active", durationMs: 1 }],
        limits,
        replayCommand: () => "run",
      }),
    ).toThrow("duplicate");
  });
});

describe("baseline comparison", () => {
  it("detects a known cost bottleneck and threshold findings", () => {
    const baseline = report(1, "1.0.0");
    const current = report(2, "2.0.0");
    const comparison = compareBaseline(baseline, current, {
      milestoneRelative: 0.2,
      actionAttemptsRelative: 0.2,
    });
    expect(comparison.paired).toBe(true);
    expect(comparison.milestones.goal).toEqual({ absoluteMs: 2_000, relative: 0.5 });
    expect(comparison.findings).toContain("milestone:goal");
    expect(comparison.findings).not.toContain("action-attempts");
    const burden = compareBaseline(
      baseline,
      {
        ...current,
        actions: { ...current.actions, attempts: current.actions.attempts * 2 },
      },
      { actionAttemptsRelative: 0.2 },
    );
    expect(burden.findings).toContain("action-attempts");
  });

  it("reports unpaired outcomes, zero baselines, newly reached, and new stalls", () => {
    const reached = report(1);
    const zero = {
      ...reached,
      actions: { ...reached.actions, attempts: 0 },
      milestones: { zero: { realTimeMs: 0, gameTimeMs: 0, activeTimeMs: 0 } },
    } satisfies HarnessReport;
    const poor = {
      ...reached,
      botSeed: "ff",
      outcome: { kind: "unreached", reason: "policy-stall" as const },
      milestones: { zero: { realTimeMs: 10, gameTimeMs: 10, activeTimeMs: 10 } },
    } satisfies HarnessReport;
    const changed = compareBaseline(zero, poor, {
      milestoneRelative: 0,
      actionAttemptsRelative: 0,
    });
    expect(changed.paired).toBe(false);
    expect(changed.milestones.zero?.relative).toBeNull();
    expect(changed.actionAttempts.relative).toBeNull();
    expect(changed.newlyUnreached).toBe(true);
    expect(changed.newStall).toBe(true);
    const newlyReached = compareBaseline(poor, reached);
    expect(newlyReached.newlyReached).toBe(true);
  });
});
