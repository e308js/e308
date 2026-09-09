import { mkdir, readFile, writeFile } from "node:fs/promises";
import { type MachineRecord, type WorkloadReport, workloadMarkdown } from "./performance-report.js";

const scenarios = ["wireworks", "cascade", "hearth"] as const;
const checkpoints = ["beginning", "middle", "ending"] as const;
const shards = scenarios.flatMap((scenario) =>
  checkpoints.map((checkpoint) => ({ scenario, checkpoint, id: `${scenario}-${checkpoint}` })),
);
const output = new URL("../../../artifacts/performance/", import.meta.url);
const reports = await Promise.all(
  shards.map(async ({ scenario, checkpoint, id }) => {
    const raw = await readFile(new URL(`workloads-${id}.json`, output), "utf8");
    const report = JSON.parse(raw) as WorkloadReport;
    if (report.schema !== "e308-workloads" || report.schemaVersion !== 1)
      throw new TypeError(`Invalid ${id} workload report`);
    if (
      report.workloads.length !== 5 ||
      report.workloads.some((row) => row.scenario !== scenario || row.checkpoint !== checkpoint)
    )
      throw new TypeError(`Incomplete ${id} workload report`);
    return report;
  }),
);
const first = reports[0];
if (!first) throw new TypeError("Performance reports are missing");
const machines = Object.fromEntries(
  shards.map(({ id }, index) => [id, reports[index]?.machine as MachineRecord]),
);
const workloads = reports.flatMap((report) => report.workloads);
const merged: WorkloadReport = {
  schema: "e308-workloads",
  schemaVersion: 1,
  machine: first.machine,
  machines,
  workloads,
};
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(new URL("workloads.json", output), `${JSON.stringify(merged, null, 2)}\n`),
  writeFile(new URL("workloads.md", output), workloadMarkdown(first.machine, workloads, machines)),
]);
