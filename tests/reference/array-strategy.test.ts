import { randomLegalPolicy, rankedPolicy, runHarness } from "@e308/core/testing";
import { describe, expect, it } from "vitest";
import { arrayProofSchedule, arrayScenario } from "../../reference/array/index.js";

describe("Array Game fresh-save strategy", () => {
  it("reaches the declared B-era endpoint through legal actions", () => {
    const report = runHarness({
      scenario: arrayScenario(),
      policy: rankedPolicy({ id: "array-balanced", version: "1" }),
      gameSeed: "a0a0",
      botSeed: "b0b0",
      goalId: "b-era",
      decisionCadenceMs: 16,
      schedule: arrayProofSchedule,
      limits: {
        maximumDecisions: 350,
        maximumTraceEntries: 350,
        maximumSamples: 100,
        sampleCadenceMs: 86_400_000,
      },
      replayCommand: "pnpm vitest run tests/reference/array-strategy.test.ts",
    });
    expect(report.outcome).toMatchObject({ kind: "reached" });
    expect(report.actions.attempts).toBe(report.actions.successful);
    expect(report.milestones).toHaveProperty("array-b-unlocked");
    expect(report.timing.fidelity).toContain("custom-reward");
  });

  it("records a slower seeded random route to the same endpoint", () => {
    const report = runHarness({
      scenario: arrayScenario(),
      policy: randomLegalPolicy({ id: "array-random", version: "1" }),
      gameSeed: "a0a0",
      botSeed: "0001",
      goalId: "b-era",
      decisionCadenceMs: 16,
      schedule: arrayProofSchedule,
      limits: {
        maximumDecisions: 350,
        maximumTraceEntries: 350,
        maximumSamples: 100,
        sampleCadenceMs: 86_400_000,
      },
      replayCommand: "pnpm vitest run tests/reference/array-strategy.test.ts",
    });
    expect(report.outcome).toMatchObject({ kind: "reached" });
    expect(report.actions.decisions).toBeGreaterThan(300);
    expect(report.outcome.kind === "reached" ? report.outcome.atRealMs : 0).toBeGreaterThan(
      20_000_000_000,
    );
  });
});
