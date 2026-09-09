import { describe, expect, it } from "vitest";
import {
  type KernelIntent,
  type KernelObservation,
  kernelScenarios,
} from "../../examples/pacing/src/scenarios.js";
import {
  goalPolicy,
  rankedPolicy,
  runHarness,
  scriptedPolicy,
} from "../../packages/core/src/testing/index.js";

const expectedGoalTimes: Readonly<Record<string, number>> = {
  wireworks: 2_000,
  cascade: 3_000,
  hearth: 1_000,
};

describe("reference-inspired pacing kernels", () => {
  for (const scenario of kernelScenarios()) {
    for (const policyName of ["scripted", "ranked", "goal"] as const) {
      it(`${scenario.id} reaches its goal with the ${policyName} policy reproducibly`, () => {
        const first = runHarness(runOptions(scenario, policyName));
        const second = runHarness(runOptions(scenario, policyName));
        expect(first).toEqual(second);
        expect(first.outcome).toEqual({
          kind: "reached",
          atRealMs: expectedGoalTimes[scenario.id],
          atGameMs: expectedGoalTimes[scenario.id],
        });
        expect(first.trace.length).toBeLessThanOrEqual(20);
        expect(first.samples.length).toBeLessThanOrEqual(20);
      });
    }
  }
});

function runOptions(
  scenario: ReturnType<typeof kernelScenarios>[number],
  policyName: "scripted" | "ranked" | "goal",
) {
  const policy = policyFor(scenario.id, policyName);
  return {
    scenario,
    policy,
    gameSeed: "00",
    botSeed: "01",
    goalId: "finish",
    decisionCadenceMs: 1_000,
    schedule: [{ kind: "active" as const, durationMs: 5_000 }],
    limits: {
      maximumDecisions: 10,
      maximumTraceEntries: 20,
      maximumSamples: 20,
      sampleCadenceMs: 1_000,
    },
    replayCommand: `pnpm report:pacing -- ${scenario.id} ${policy.id}`,
  };
}

function policyFor(scenarioId: string, name: "scripted" | "ranked" | "goal") {
  if (name === "scripted")
    return scriptedPolicy<KernelObservation, KernelIntent>({
      id: "scripted",
      version: "1",
      actions: scenarioId === "hearth" ? ["cook"] : [],
      repeat: true,
    });
  if (name === "ranked") return rankedPolicy<KernelObservation, KernelIntent>({ version: "1" });
  return goalPolicy<KernelObservation, KernelIntent>({
    id: "goal",
    version: "1",
    score: (_context, quote) => quote.rank ?? 0,
  });
}
