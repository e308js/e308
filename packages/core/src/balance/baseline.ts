import type { HarnessReport } from "../testing/types.js";
import type { BaselineComparison, BaselineThresholds } from "./types.js";

export function compareBaseline(
  baseline: HarnessReport,
  current: HarnessReport,
  thresholds: BaselineThresholds = {},
): BaselineComparison {
  const paired = pairedIdentity(baseline) === pairedIdentity(current);
  const milestones: Record<string, { absoluteMs: number; relative: number | null }> = {};
  for (const id of new Set([
    ...Object.keys(baseline.milestones),
    ...Object.keys(current.milestones),
  ])) {
    const before = baseline.milestones[id]?.realTimeMs;
    const after = current.milestones[id]?.realTimeMs;
    if (before === undefined || after === undefined) continue;
    milestones[id] = { absoluteMs: after - before, relative: ratio(before, after) };
  }
  const actionAttempts = {
    absolute: current.actions.attempts - baseline.actions.attempts,
    relative: ratio(baseline.actions.attempts, current.actions.attempts),
  };
  const findings = findingsFor(milestones, actionAttempts.relative, thresholds);
  const baselineReached = baseline.outcome.kind === "reached";
  const currentReached = current.outcome.kind === "reached";
  return {
    paired,
    baseline: { contentVersion: baseline.contentVersion, outcome: outcomeName(baseline) },
    current: { contentVersion: current.contentVersion, outcome: outcomeName(current) },
    milestones,
    actionAttempts,
    newlyReached: !baselineReached && currentReached,
    newlyUnreached: baselineReached && !currentReached,
    newStall: !isStall(baseline) && isStall(current),
    findings,
  };
}

function pairedIdentity(report: HarnessReport): string {
  return JSON.stringify([
    report.scenarioId,
    report.gameSeed,
    report.botSeed,
    report.policy,
    report.goalId,
    report.schedule,
    report.decisionCadenceMs,
  ]);
}

function ratio(before: number, after: number): number | null {
  return before === 0 ? null : (after - before) / before;
}

function outcomeName(report: HarnessReport): string {
  if (report.outcome.kind === "unreached") return report.outcome.reason;
  if (report.outcome.kind === "certified-barrier") return "certified-barrier";
  return "reached";
}

function isStall(report: HarnessReport): boolean {
  return (
    report.outcome.kind === "unreached" &&
    (report.outcome.reason === "policy-stall" || report.outcome.reason === "observed-stall")
  );
}

function findingsFor(
  milestones: BaselineComparison["milestones"],
  actionRelative: number | null,
  thresholds: BaselineThresholds,
): string[] {
  const findings: string[] = [];
  if (thresholds.milestoneRelative !== undefined) {
    for (const [id, change] of Object.entries(milestones)) {
      if (change.relative !== null && Math.abs(change.relative) > thresholds.milestoneRelative)
        findings.push(`milestone:${id}`);
    }
  }
  if (
    thresholds.actionAttemptsRelative !== undefined &&
    actionRelative !== null &&
    Math.abs(actionRelative) > thresholds.actionAttemptsRelative
  )
    findings.push("action-attempts");
  return findings;
}
