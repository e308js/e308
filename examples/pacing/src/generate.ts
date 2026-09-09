import { compareBaseline, runSweep } from "@e308/core/balance";
import { goalPolicy, rankedPolicy, runHarness, scriptedPolicy } from "@e308/core/testing";
import {
  hearthScenario,
  type KernelIntent,
  type KernelObservation,
  kernelScenarios,
} from "./scenarios.js";
import { writeReportSet } from "./write-reports.js";

const output = new URL("../../../artifacts/pacing/", import.meta.url);
const reports = kernelScenarios().flatMap((scenario) =>
  policies(scenario.id).map((policy) =>
    runHarness({
      scenario,
      policy,
      gameSeed: "00",
      botSeed: "01",
      goalId: "finish",
      decisionCadenceMs: 1_000,
      schedule: [{ kind: "active", durationMs: 5_000 }],
      limits: {
        maximumDecisions: 10,
        maximumTraceEntries: 20,
        maximumSamples: 20,
        sampleCadenceMs: 1_000,
      },
      replayCommand: `pnpm report:pacing -- ${scenario.id} ${policy.id} 00 01`,
    }),
  ),
);

const sweep = runSweep({
  cases: [
    { id: "cost-2", parameters: { cost: 2 } },
    { id: "cost-3", parameters: { cost: 3 } },
  ],
  seeds: [{ gameSeed: "00", botSeed: "01" }],
  policies: [rankedPolicy<KernelObservation, KernelIntent>({ version: "1" })],
  createScenario: ({ cost }) => costScenario(cost),
  goalId: "finish",
  decisionCadenceMs: 1_000,
  schedule: [{ kind: "active", durationMs: 5_000 }],
  limits: {
    maximumDecisions: 10,
    maximumTraceEntries: 20,
    maximumSamples: 20,
    sampleCadenceMs: 1_000,
  },
  replayCommand: (id) => `pnpm report:pacing -- sweep ${id}`,
});
const valid = sweep.filter((result) => result.kind === "valid");
const baselineReport = valid[0]?.report;
const currentReport = valid[1]?.report;
if (!baselineReport || !currentReport)
  throw new TypeError("Pacing sweep did not produce two reports");
const baseline = compareBaseline(baselineReport, currentReport, { milestoneRelative: 0.1 });

await writeReportSet({
  output,
  reports,
  fileName: (report) => `${report.scenarioId}-${report.policy.id}.md`,
  extras: [
    { name: "sweep.json", contents: `${JSON.stringify(sweep, null, 2)}\n` },
    { name: "baseline.json", contents: `${JSON.stringify(baseline, null, 2)}\n` },
  ],
});

function policies(scenarioId: string) {
  const actions = scenarioId === "hearth" ? ["cook"] : [];
  return [
    scriptedPolicy<KernelObservation, KernelIntent>({
      id: "scripted",
      version: "1",
      actions,
      repeat: true,
    }),
    rankedPolicy<KernelObservation, KernelIntent>({ version: "1" }),
    goalPolicy<KernelObservation, KernelIntent>({
      id: "goal",
      version: "1",
      score: (_context, quote) => quote.rank ?? 0,
    }),
  ];
}

function costScenario(cost: number) {
  const hearth = hearthScenario(cost);
  return { ...hearth, contentVersion: `cost-${cost}`, parameters: { cost } };
}
