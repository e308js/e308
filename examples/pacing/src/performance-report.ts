export interface MachineRecord {
  readonly platform: string;
  readonly architecture: string;
  readonly cpu: string;
  readonly logicalCpus: number;
  readonly memoryBytes: number;
  readonly node: string;
  readonly commit: string;
}

export interface WorkloadRecord {
  readonly scenario: string;
  readonly duration: string;
  readonly durationMs: number;
  readonly cold: import("@e308/core/optimize").ProfileReport;
  readonly warm: import("@e308/core/optimize").ProfileReport;
}

export function workloadMarkdown(
  machine: MachineRecord,
  workloads: readonly WorkloadRecord[],
): string {
  const lines = [
    "# Advancement workload report",
    "",
    `Runtime: ${machine.node}; ${machine.platform}/${machine.architecture}; ${machine.cpu}; ${machine.logicalCpus} logical CPUs; ${machine.memoryBytes} bytes RAM`,
    `Commit: ${machine.commit}`,
    "",
    "CI timings are diagnostics. Release performance claims require the named reference-machine procedure.",
    "",
    "| Scenario | Gap | Fidelity | Warm runs | Warm p50 ms | Warm p95 ms | Longest batch ms | Bulk steps | Canonical steps | Pending ms |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const item of workloads) {
    lines.push(
      `| ${item.scenario} | ${item.duration} | ${fidelity(item.warm)} | ${item.warm.repetitions} | ${rounded(item.warm.elapsed.medianMs)} | ${rounded(item.warm.elapsed.p95Ms)} | ${item.warm.longestBatchGameMs} | ${item.warm.bulkSteps} | ${item.warm.canonicalSteps} | ${item.warm.pendingMs} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function fidelity(report: import("@e308/core/optimize").ProfileReport): string {
  if (report.bulkSteps > 0) return "validated-bulk";
  return report.pendingMs > 0 ? "canonical-pending" : "canonical";
}

function rounded(value: number): string {
  return value.toFixed(3);
}
