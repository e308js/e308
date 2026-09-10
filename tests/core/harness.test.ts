import { describe, expect, it } from "vitest";
import {
  assessPlayability,
  type BotPolicy,
  goalPolicy,
  type HarnessRunOptions,
  orderedPolicy,
  randomLegalPolicy,
  rankedLegalQuotes,
  rankedPolicy,
  replayHarness,
  reportJson,
  reportMarkdown,
  runHarness,
  scriptedPolicy,
  successfulTrace,
} from "../../packages/core/src/testing/index.js";
import {
  baseHarnessParameters,
  type HarnessIntent,
  type HarnessObservation,
  harnessScenario,
} from "../helpers/harness-fixture.js";

function options(
  overrides: Partial<HarnessRunOptions<number, HarnessObservation, HarnessIntent>> = {},
): HarnessRunOptions<number, HarnessObservation, HarnessIntent> {
  return {
    scenario: harnessScenario(baseHarnessParameters),
    policy: rankedPolicy({ version: "1" }),
    gameSeed: "00",
    botSeed: "01",
    goalId: "tokens",
    decisionCadenceMs: 1_000,
    maximumImmediateActions: 1,
    schedule: [{ kind: "active", durationMs: 10_000 }],
    limits: {
      maximumDecisions: 20,
      maximumTraceEntries: 20,
      maximumSamples: 20,
      sampleCadenceMs: 1_000,
    },
    replayCommand: "pnpm report:pacing -- fixture",
    ...overrides,
  };
}

describe("headless harness", () => {
  it("reaches authored goals through revision-bound player actions and replays the trace", () => {
    const configured = options();
    const report = runHarness(configured);
    expect(report.outcome).toEqual({ kind: "reached", atRealMs: 6_000, atGameMs: 6_000 });
    expect(report.actions).toMatchObject({ successful: 3, decisions: 7 });
    expect(report.milestones).toMatchObject({
      "first-token": { realTimeMs: 2_000, gameTimeMs: 2_000 },
      goal: { realTimeMs: 6_000, gameTimeMs: 6_000 },
    });
    expect(report.constraints["insufficient-input:points"]).toBeGreaterThan(0);
    expect(report.parameters).toEqual(baseHarnessParameters);
    const replay = replayHarness({ scenario: configured.scenario, report });
    expect(replay.appliedActions).toBe(3);
    expect(replay.snapshot.resources.tokens).toBe(3);
    expect(replay.snapshot.resources.points).toBeCloseTo(0);
    expect(successfulTrace(report.trace)).toHaveLength(3);
    expect(JSON.parse(reportJson(report))).toMatchObject({ schema: "e308-pacing-report" });
    expect(reportMarkdown(report)).toContain("| goal | 6000 | 6000 | 6000 |");
  });

  it("makes decisions only while active and accounts for capped absence", () => {
    const scenario = harnessScenario({
      ...baseHarnessParameters,
      cost: 1,
      target: 1,
      awayCapMs: 500,
    });
    const report = runHarness(
      options({
        scenario,
        schedule: [
          { kind: "idle-open", durationMs: 1_000 },
          { kind: "absent", durationMs: 2_000 },
          { kind: "active", durationMs: 1_000 },
        ],
      }),
    );
    expect(report.actions.decisions).toBe(1);
    expect(report.outcome).toMatchObject({ kind: "reached", atRealMs: 3_000 });
    expect(report.timing).toMatchObject({
      realElapsedMs: 3_000,
      gameAdvancedMs: 1_500,
      activePlayerMs: 0,
      idleOpenMs: 1_000,
      absentMs: 2_000,
      discardedRealMs: 1_500,
    });
    expect(replayHarness({ scenario, report }).snapshot.resources.tokens).toBe(1);
  });

  it("measures player relief separately from passive progress and deadlocks", () => {
    const blockedBase = harnessScenario({
      ...baseHarnessParameters,
      rate: 0,
      target: 20,
      noActions: true,
    });
    const blocked = runHarness(
      options({
        scenario: {
          ...blockedBase,
          pressures: () => [
            {
              id: "fixed-cap",
              kind: "capacity" as const,
              active: true,
              detail: "The fixed cap blocks the goal.",
              relief: [],
            },
          ],
        },
        schedule: [{ kind: "active", durationMs: 3_000 }],
      }),
    );
    expect(blocked.playability.pressures["fixed-cap"]).toMatchObject({
      observedMs: 3_000,
      noReliefMs: 3_000,
      longestNoReliefMs: 3_000,
    });
    expect(assessPlayability(blocked, { maximumNoReliefMs: 2_000 })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "goal-deadlock",
          severity: "p0",
          pressureId: "fixed-cap",
        }),
      ]),
    );

    const passiveBase = harnessScenario({ ...baseHarnessParameters, target: 20 });
    const passive = runHarness(
      options({
        scenario: {
          ...passiveBase,
          pressures: () => [
            {
              id: "growth",
              kind: "prerequisite" as const,
              active: true,
              detail: "Production is advancing the prerequisite.",
              relief: [{ kind: "passive" as const, estimatedMs: 12_000 }],
            },
          ],
        },
        schedule: [{ kind: "idle-open", durationMs: 2_000 }],
      }),
    );
    expect(passive.playability.pressures.growth).toMatchObject({
      passiveMs: 2_000,
      noReliefMs: 0,
      maximumPassiveEstimateMs: 12_000,
    });
    expect(assessPlayability(passive, { maximumNoReliefMs: 0 })).toEqual([]);
    expect(reportMarkdown(passive)).toContain("| growth | 2000 | 0 | 0 | 2000 | 0 |");
  });

  it("distinguishes policy stalls, observed stalls, barriers, schedule end, and work limits", () => {
    const poor = runHarness(
      options({
        policy: scriptedPolicy({ id: "poor", version: "1", actions: [] }),
        schedule: [{ kind: "active", durationMs: 3_000 }],
      }),
    );
    expect(poor.outcome).toEqual({ kind: "unreached", reason: "policy-stall" });
    const observed = runHarness(
      options({
        scenario: harnessScenario({ ...baseHarnessParameters, rate: 0 }),
        schedule: [{ kind: "active", durationMs: 1_000 }],
      }),
    );
    expect(observed.outcome).toEqual({ kind: "unreached", reason: "observed-stall" });
    const barrier = runHarness(
      options({
        scenario: harnessScenario({
          ...baseHarnessParameters,
          capacity: 1,
          certified: true,
        }),
        schedule: [{ kind: "active", durationMs: 1_000 }],
      }),
    );
    expect(barrier.outcome).toMatchObject({
      kind: "certified-barrier",
      certificate: { id: "capacity-below-token-cost" },
    });
    const ended = runHarness(
      options({
        scenario: harnessScenario({ ...baseHarnessParameters, noActions: true }),
        schedule: [{ kind: "idle-open", durationMs: 1_000 }],
      }),
    );
    expect(ended.outcome).toEqual({ kind: "unreached", reason: "schedule-ended" });
    const limited = runHarness(
      options({
        limits: { ...options().limits, maximumDecisions: 1 },
        schedule: [{ kind: "active", durationMs: 5_000 }],
      }),
    );
    expect(limited.outcome).toEqual({ kind: "unreached", reason: "work-limit" });
    expect(limited.timing.realElapsedMs).toBe(1_000);
  });

  it("bounds traces and samples while retaining aggregates", () => {
    const report = runHarness(
      options({
        scenario: harnessScenario({ ...baseHarnessParameters, target: 20 }),
        policy: scriptedPolicy({
          id: "repeat",
          version: "1",
          actions: ["buy-token"],
          repeat: true,
        }),
        schedule: [{ kind: "active", durationMs: 5_000 }],
        limits: {
          maximumDecisions: 10,
          maximumTraceEntries: 1,
          maximumSamples: 1,
          sampleCadenceMs: 1,
        },
      }),
    );
    expect(report.trace).toHaveLength(1);
    expect(report.traceTruncated).toBeGreaterThan(0);
    expect(report.samples).toHaveLength(1);
    expect(report.samplesTruncated).toBeGreaterThan(0);
    expect(report.actions.attempts).toBe(5);
  });

  it("replays seeded random legal actions deterministically", () => {
    const configured = options({
      policy: randomLegalPolicy({ version: "1" }),
      botSeed: "aabbccdd",
    });
    const first = runHarness(configured);
    const second = runHarness({
      ...configured,
      policy: randomLegalPolicy({ version: "1" }),
    });
    expect(first.outcome).toEqual({ kind: "reached", atRealMs: 6_000, atGameMs: 6_000 });
    expect(second.trace).toEqual(first.trace);
    expect(
      replayHarness({ scenario: configured.scenario, report: first }).snapshot.resources.tokens,
    ).toBe(3);
  });

  it("waits for each action in an authored route before advancing", () => {
    const report = runHarness(
      options({
        policy: orderedPolicy({
          id: "winning-route",
          version: "1",
          actions: ["buy-token", "buy-token", "buy-token"],
        }),
      }),
    );
    expect(report.outcome).toEqual({ kind: "reached", atRealMs: 6_000, atGameMs: 6_000 });
    expect(report.actions).toMatchObject({ attempts: 3, successful: 3 });

    const policy = orderedPolicy<HarnessObservation, HarnessIntent>({
      id: "upgrade-route",
      version: "1",
      actions: ["first", "second"],
    });
    const context = {
      observation: { points: 0, tokens: 0 },
      goalId: "goal",
      realTimeMs: 0,
      decision: 0,
      random: () => 0,
    };
    const quote = (id: string, legal: boolean) => ({
      id,
      revision: "0",
      intent: { kind: "buy-token" as const },
      legal,
      useful: true,
      constraints: [],
    });
    expect(policy.decide({ ...context, quotes: [quote("first", false)] })).toEqual({
      kind: "wait",
      reason: "route-wait:first",
    });
    expect(policy.decide({ ...context, quotes: [quote("first", true)] })).toEqual({
      kind: "action",
      actionId: "first",
    });
    expect(policy.decide({ ...context, quotes: [quote("second", true)] })).toEqual({
      kind: "action",
      actionId: "second",
    });
    expect(policy.decide({ ...context, quotes: [] })).toEqual({
      kind: "wait",
      reason: "route-complete",
    });
  });

  it("records missing, blocked, and failed selections without privileged mutation", () => {
    const missing: BotPolicy<HarnessObservation, HarnessIntent> = {
      id: "missing",
      version: "1",
      decide: () => ({ kind: "action", actionId: "not-quoted" }),
    };
    const missingReport = runHarness(
      options({ policy: missing, schedule: [{ kind: "active", durationMs: 1_000 }] }),
    );
    expect(missingReport.trace[0]?.result).toBe("missing-quote");
    expect(missingReport.constraints["policy:missing-quote"]).toBe(1);
    expect(
      replayHarness({ scenario: options().scenario, report: missingReport }).appliedActions,
    ).toBe(0);

    const base = harnessScenario({ ...baseHarnessParameters, cost: 0, target: 1 });
    const failing = {
      ...base,
      command: () => ({
        id: "fail",
        execute: (transaction: Parameters<ReturnType<typeof base.command>["execute"]>[0]) =>
          transaction.reject({ code: "invalid-target", id: "forced" }),
      }),
    };
    const failed = runHarness(
      options({ scenario: failing, schedule: [{ kind: "active", durationMs: 1_000 }] }),
    );
    expect(failed.trace[0]?.result).toBe("invalid-target");
    expect(failed.actions.successful).toBe(0);
  });

  it("rejects stale and ambiguous quotes before command construction", () => {
    const base = harnessScenario({ ...baseHarnessParameters, cost: 0, target: 1 });
    const stale = {
      ...base,
      quote: (snapshot: Parameters<typeof base.quote>[0]) =>
        base.quote(snapshot).map((quote) => ({ ...quote, revision: "999" })),
    };
    const staleReport = runHarness(
      options({ scenario: stale, schedule: [{ kind: "active", durationMs: 1_000 }] }),
    );
    expect(staleReport.trace[0]?.result).toBe("stale-revision");
    expect(staleReport.actions.successful).toBe(0);
    expect(staleReport.constraints["policy:stale-revision"]).toBe(1);

    const duplicate = {
      ...base,
      quote: (snapshot: Parameters<typeof base.quote>[0]) => {
        const quote = base.quote(snapshot)[0];
        return quote ? [quote, quote] : [];
      },
    };
    expect(() =>
      runHarness(options({ scenario: duplicate, schedule: [{ kind: "active", durationMs: 1 }] })),
    ).toThrow("Duplicate harness action quote");
  });

  it("validates goals, schedules, limits, seeds, away identity, and replay ordering", () => {
    expect(() => runHarness(options({ goalId: "missing" }))).toThrow("Unknown harness goal");
    expect(() => runHarness(options({ botSeed: "bad" }))).toThrow("Bot seed");
    expect(() => runHarness(options({ schedule: [] }))).toThrow("schedule");
    expect(() => runHarness(options({ decisionCadenceMs: 0 }))).toThrow("cadence");
    expect(() => runHarness(options({ maximumImmediateActions: 0 }))).toThrow("cadence");
    expect(() => runHarness(options({ actionSpace: "complete" }))).toThrow("scenario.quoteAll");
    const base = harnessScenario(baseHarnessParameters);
    const divergent = {
      ...base,
      advanceAway: () => ({
        snapshot: base.create("00").getSnapshot(),
        fidelity: "canonical" as const,
        discardedRealMs: 0,
        bankedRealMs: 0,
      }),
    };
    expect(() =>
      runHarness(options({ scenario: divergent, schedule: [{ kind: "absent", durationMs: 1 }] })),
    ).toThrow("supplied game");
    const report = runHarness(options());
    const unordered = { ...report, trace: [...report.trace].reverse() };
    expect(() => replayHarness({ scenario: options().scenario, report: unordered })).toThrow(
      "not ordered",
    );
    const tooLong = { ...report, timing: { ...report.timing, realElapsedMs: 20_000 } };
    expect(() => replayHarness({ scenario: options().scenario, report: tooLong })).toThrow(
      "exceeds",
    );
  });

  it("supports game-authored goal scoring", () => {
    const policy = goalPolicy<HarnessObservation, HarnessIntent>({
      id: "goal",
      version: "1",
      score: (context, quote) => context.observation.points + (quote.id === "buy-token" ? 1 : 0),
    });
    expect(runHarness(options({ policy })).outcome.kind).toBe("reached");
    const noScore = goalPolicy<HarnessObservation, HarnessIntent>({
      id: "no-score",
      version: "1",
      score: () => Number.NaN,
    });
    expect(
      runHarness(options({ policy: noScore, schedule: [{ kind: "active", durationMs: 1_000 }] }))
        .actions.waits,
    ).toBe(1);
  });

  it("provides deterministic scripted and ranked policy choices", () => {
    const script = scriptedPolicy<HarnessObservation, HarnessIntent>({
      id: "script",
      version: "1",
      actions: ["one"],
    });
    const context = {
      observation: { points: 0, tokens: 0 },
      quotes: [],
      goalId: "tokens",
      realTimeMs: 0,
      decision: 0,
      random: () => 0.99,
    };
    expect(script.decide(context)).toEqual({ kind: "action", actionId: "one" });
    expect(script.decide(context)).toEqual({ kind: "wait", reason: "script-complete" });
    const ranked = rankedPolicy<HarnessObservation, HarnessIntent>({ id: "greedy", version: "1" });
    const quotes = [
      {
        id: "low",
        revision: "0",
        intent: { kind: "buy-token" as const },
        legal: true,
        useful: true,
        constraints: [],
      },
      {
        id: "high-a",
        revision: "0",
        intent: { kind: "buy-token" as const },
        legal: true,
        useful: true,
        rank: 2,
        constraints: [],
      },
      {
        id: "high-b",
        revision: "0",
        intent: { kind: "buy-token" as const },
        legal: true,
        useful: true,
        rank: 2,
        constraints: [],
      },
    ];
    expect(ranked.decide({ ...context, quotes })).toEqual({ kind: "action", actionId: "high-b" });
    const blocked = {
      id: "blocked",
      revision: "0",
      intent: { kind: "buy-token" as const },
      legal: false,
      useful: true,
      constraints: [],
    };
    expect(rankedLegalQuotes([...quotes, blocked])).toEqual([quotes[1], quotes[2], quotes[0]]);
  });
});
