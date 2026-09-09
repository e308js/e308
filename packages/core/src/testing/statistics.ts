import type { HarnessReport, HarnessValue, UnreachedReason } from "./types.js";

export interface Distribution {
  readonly count: number;
  readonly minimum: number;
  readonly mean: number;
  readonly p50: number;
  readonly p95: number;
  readonly maximum: number;
}

export interface HarnessAggregate {
  readonly total: number;
  readonly reached: number;
  readonly unreached: Readonly<Record<UnreachedReason | "certified-barrier", number>>;
  readonly completionRealMs: Distribution | null;
  readonly completionGameMs: Distribution | null;
  readonly actionAttempts: Distribution | null;
}

export function aggregateReports(
  reports: readonly HarnessReport<HarnessValue>[],
): HarnessAggregate {
  const reached = reports.filter(
    (
      report,
    ): report is HarnessReport & {
      outcome: { kind: "reached"; atRealMs: number; atGameMs: number };
    } => report.outcome.kind === "reached",
  );
  const unreached: Record<UnreachedReason | "certified-barrier", number> = {
    "policy-stall": 0,
    "observed-stall": 0,
    "schedule-ended": 0,
    "work-limit": 0,
    "invalid-configuration": 0,
    "certified-barrier": 0,
  };
  for (const report of reports) {
    if (report.outcome.kind === "certified-barrier") unreached["certified-barrier"] += 1;
    if (report.outcome.kind === "unreached") unreached[report.outcome.reason] += 1;
  }
  return {
    total: reports.length,
    reached: reached.length,
    unreached,
    completionRealMs: distribution(reached.map((report) => report.outcome.atRealMs)),
    completionGameMs: distribution(reached.map((report) => report.outcome.atGameMs)),
    actionAttempts: distribution(reached.map((report) => report.actions.attempts)),
  };
}

export function distribution(values: readonly number[]): Distribution | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    count: sorted.length,
    minimum: sorted[0] as number,
    mean: sum / sorted.length,
    p50: nearestRank(sorted, 0.5),
    p95: nearestRank(sorted, 0.95),
    maximum: sorted.at(-1) as number,
  };
}

function nearestRank(sorted: readonly number[], quantile: number): number {
  const rank = Math.max(1, Math.ceil(quantile * sorted.length));
  return sorted[rank - 1] as number;
}
