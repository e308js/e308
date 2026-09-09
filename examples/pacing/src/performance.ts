import { mkdir, writeFile } from "node:fs/promises";
import { cpus, totalmem } from "node:os";
import { createGame, type GameDefinition, type Snapshot } from "@e308/core";
import { profileAdvancement } from "@e308/core/optimize";
import { createCascadeKernel, createHearthKernel, createWireworksKernel } from "./kernels.js";
import { type MachineRecord, type WorkloadRecord, workloadMarkdown } from "./performance-report.js";

const gaps = [
  ["1 minute", 60_000],
  ["1 hour", 60 * 60_000],
  ["8 hours", 8 * 60 * 60_000],
  ["1 day", 24 * 60 * 60_000],
  ["30 days", 30 * 24 * 60 * 60_000],
] as const;
const scenarios = [
  scenario("wireworks", createWireworksKernel()),
  scenario("cascade", createCascadeKernel()),
  scenario("hearth", createHearthKernel()),
];
const workloads: WorkloadRecord[] = [];

for (const item of scenarios) {
  for (const [duration, durationMs] of gaps) {
    const common = {
      fixtureId: item.id,
      fixtureVersion: "kernel-1",
      elapsedMs: durationMs,
      definition: item.definition,
      createGame: () => createGame(item.definition, { snapshot: item.initial }),
      advancement: {
        mode: "exact" as const,
        limits: { maximumWork: 200_000, maximumBulkBatches: 100 },
      },
      now: () => performance.now(),
    };
    workloads.push({
      scenario: item.id,
      duration,
      durationMs,
      cold: profileAdvancement({ ...common, label: "cold", repetitions: 1 }),
      warm: profileAdvancement({
        ...common,
        label: "warm",
        repetitions: duration === "8 hours" ? 10 : duration === "30 days" ? 1 : 3,
      }),
    });
  }
}

const machine: MachineRecord = {
  platform: process.platform,
  architecture: process.arch,
  cpu: cpus()[0]?.model ?? "unknown",
  logicalCpus: cpus().length,
  memoryBytes: totalmem(),
  node: process.version,
  commit: process.env.GITHUB_SHA ?? "local-worktree",
};
const output = new URL("../../../artifacts/performance/", import.meta.url);
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(
    new URL("workloads.json", output),
    `${JSON.stringify({ schema: "e308-workloads", schemaVersion: 1, machine, workloads }, null, 2)}\n`,
  ),
  writeFile(new URL("workloads.md", output), workloadMarkdown(machine, workloads)),
]);

function scenario(
  id: string,
  kernel: {
    readonly definition: GameDefinition<number>;
    readonly game: { getSnapshot(): Snapshot<number> };
  },
) {
  return { id, definition: kernel.definition, initial: kernel.game.getSnapshot() };
}
