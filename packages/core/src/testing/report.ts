import type { HarnessAggregate } from "./statistics.js";
import type { HarnessReport, HarnessValue } from "./types.js";

export function reportJson(report: HarnessReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function reportMarkdown(report: HarnessReport): string {
  const outcome =
    report.outcome.kind === "reached"
      ? `reached at ${report.outcome.atRealMs} ms real / ${report.outcome.atGameMs} ms game`
      : report.outcome.kind === "certified-barrier"
        ? `certified barrier: ${report.outcome.certificate.id}`
        : `unreached: ${report.outcome.reason}`;
  const lines = [
    `# Pacing report: ${report.scenarioId}`,
    "",
    `- Content: ${report.contentVersion} (${report.contentDigest})`,
    `- Simulation: v${report.simulationVersion}, ${report.stepMs} ms steps`,
    `- Numeric backend: ${report.numericAdapter}@${report.numericImplementationVersion}`,
    `- Policy: ${report.policy.id}@${report.policy.version}`,
    `- Seeds: game ${report.gameSeed}, bot ${report.botSeed}`,
    `- Goal: ${report.goalId} — ${outcome}`,
    `- Time: ${report.timing.realElapsedMs} ms real, ${report.timing.gameAdvancedMs} ms game, ${report.timing.activePlayerMs} ms active`,
    `- Actions: ${report.actions.successful}/${report.actions.attempts} successful; ${report.actions.waits} waits`,
    `- Replay: \`${report.replayCommand}\``,
    "",
    "## First passage",
    "",
    "| Milestone | Real ms | Game ms | Active ms |",
    "| --- | ---: | ---: | ---: |",
    ...Object.entries(report.milestones).map(
      ([id, time]) => `| ${id} | ${time.realTimeMs} | ${time.gameTimeMs} | ${time.activeTimeMs} |`,
    ),
    "",
    "## Constraints",
    "",
    ...Object.entries(report.constraints).map(([id, count]) => `- ${id}: ${count}`),
    "",
    "## Playability pressures",
    "",
    "| Pressure | Observed ms | Action ms | Saving ms | Passive ms | No relief ms |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...Object.entries(report.playability.pressures).map(
      ([id, value]) =>
        `| ${id} | ${value.observedMs} | ${value.actionableMs} | ${value.savingMs} | ${value.passiveMs} | ${value.noReliefMs} |`,
    ),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export function aggregateMarkdown(aggregate: HarnessAggregate): string {
  return [
    "# Pacing aggregate",
    "",
    `Runs: ${aggregate.total}; reached: ${aggregate.reached}; unreached: ${aggregate.total - aggregate.reached}`,
    `Conditional real completion: ${formatDistribution(aggregate.completionRealMs)}`,
    `Conditional game completion: ${formatDistribution(aggregate.completionGameMs)}`,
    `Conditional action attempts: ${formatDistribution(aggregate.actionAttempts)}`,
    "",
    ...Object.entries(aggregate.unreached).map(([reason, count]) => `- ${reason}: ${count}`),
    "",
  ].join("\n");
}

function formatDistribution(value: HarnessAggregate["completionRealMs"]): string {
  return value
    ? `n=${value.count}, min=${value.minimum}, mean=${value.mean}, p50=${value.p50}, p95=${value.p95}, max=${value.maximum}`
    : "none reached";
}

export function reportsJson(reports: readonly HarnessReport<HarnessValue>[]): string {
  return `${JSON.stringify(reports, null, 2)}\n`;
}
