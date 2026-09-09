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
  readonly checkpoint: "beginning" | "middle" | "ending";
  readonly duration: string;
  readonly durationMs: number;
  readonly cold: import("@e308/core/optimize").ProfileReport;
  readonly warm: import("@e308/core/optimize").ProfileReport;
}

export interface WorkloadReport {
  readonly schema: "e308-workloads";
  readonly schemaVersion: 1;
  readonly machine: MachineRecord;
  readonly machines?: Readonly<Record<string, MachineRecord>>;
  readonly workloads: readonly WorkloadRecord[];
}

export function workloadMarkdown(
  machine: MachineRecord,
  workloads: readonly WorkloadRecord[],
  machines?: Readonly<Record<string, MachineRecord>>,
): string {
  const lines = [
    "# Advancement workload report",
    "",
    `Runtime: ${machine.node}; ${machine.platform}/${machine.architecture}; ${machine.cpu}; ${machine.logicalCpus} logical CPUs; ${machine.memoryBytes} bytes RAM`,
    `Commit: ${machine.commit}`,
    "",
    ...machineLines(machines),
    "CI timings are diagnostics. Release performance claims require the named reference-machine procedure.",
    "Cold measurements begin before an explicit fixture warm-up and create a fresh game per run; warm measurements immediately follow with the same fresh-game isolation.",
    "",
    "| Scenario | Checkpoint | Gap | Fidelity | Cold runs | Cold p95 ms | Warm runs | Warm p50 ms | Warm p95 ms | Longest batch ms | Pending ms |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const item of workloads) {
    lines.push(
      `| ${item.scenario} | ${item.checkpoint} | ${item.duration} | ${fidelity(item.warm)} | ${item.cold.repetitions} | ${rounded(item.cold.elapsed.p95Ms)} | ${item.warm.repetitions} | ${rounded(item.warm.elapsed.medianMs)} | ${rounded(item.warm.elapsed.p95Ms)} | ${item.warm.longestBatchGameMs} | ${item.warm.pendingMs} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function machineLines(machines: Readonly<Record<string, MachineRecord>> | undefined): string[] {
  if (!machines) return [];
  return [
    "CI shards:",
    ...Object.entries(machines).map(
      ([scenario, machine]) =>
        `- ${scenario}: ${machine.node}; ${machine.platform}/${machine.architecture}; ${machine.cpu}; ${machine.logicalCpus} logical CPUs`,
    ),
    "",
  ];
}

function fidelity(report: import("@e308/core/optimize").ProfileReport): string {
  if (report.bulkSteps > 0) return "validated-bulk";
  return report.pendingMs > 0 ? "canonical-pending" : "canonical";
}

function rounded(value: number): string {
  return value.toFixed(3);
}
