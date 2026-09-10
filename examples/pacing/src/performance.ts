import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, totalmem } from "node:os";
import { createGame, type GameDefinition, type SaveCodec, type Snapshot } from "@e308/core";
import { type BulkCapability, profileAdvancement } from "@e308/core/optimize";
import { cascadeBulkCapability, cascadeDefinition, cascadeSaveCodec } from "@e308/game-cascade";
import { hearthDefinition, hearthSaveCodec } from "@e308/game-hearth";
import { wireworksDefinition, wireworksSaveCodec } from "@e308/game-wireworks";
import { type MachineRecord, type WorkloadRecord, workloadMarkdown } from "./performance-report.js";

const gaps = [
  ["1 minute", 60_000],
  ["1 hour", 60 * 60_000],
  ["8 hours", 8 * 60 * 60_000],
  ["1 day", 24 * 60 * 60_000],
  ["30 days", 30 * 24 * 60 * 60_000],
] as const;
const workloads: WorkloadRecord[] = [];
const requested = process.argv.slice(2).filter((argument) => argument !== "--");
const requestedGame = requested[0];
const requestedCheckpoint = requested[1];
const requestedDuration = requested[2];
if (requestedGame && !["wireworks", "cascade", "hearth"].includes(requestedGame))
  throw new TypeError(`Unknown performance scenario: ${requestedGame}`);
if (requestedCheckpoint && !["beginning", "middle", "ending"].includes(requestedCheckpoint))
  throw new TypeError(`Unknown performance checkpoint: ${requestedCheckpoint}`);
if (requestedCheckpoint && !requestedGame)
  throw new TypeError("A checkpoint requires a performance scenario");
if (requestedDuration && !gaps.some(([label]) => label === requestedDuration))
  throw new TypeError(`Unknown performance duration: ${requestedDuration}`);
if (requestedDuration && !requestedCheckpoint)
  throw new TypeError("A duration requires a performance checkpoint");
const checkpointFile = JSON.parse(
  await readFile(
    new URL("../../../artifacts/finished-games/checkpoints.json", import.meta.url),
    "utf8",
  ),
) as CheckpointFile;
if (!requestedGame || requestedGame === "wireworks")
  profileScenario("wireworks", wireworksDefinition, decoded(wireworksSaveCodec, "wireworks"));
if (!requestedGame || requestedGame === "cascade")
  profileScenario("cascade", cascadeDefinition, decoded(cascadeSaveCodec, "cascade"), [
    cascadeBulkCapability,
  ]);
if (!requestedGame || requestedGame === "hearth")
  profileScenario("hearth", hearthDefinition, decoded(hearthSaveCodec, "hearth"));

function profileScenario<N>(
  id: string,
  definition: GameDefinition<N>,
  saves: Checkpoints<N>,
  capabilities: readonly BulkCapability<N>[] = [],
): void {
  for (const [checkpoint, initial] of Object.entries(saves) as Entries<Checkpoints<N>>) {
    if (requestedCheckpoint && checkpoint !== requestedCheckpoint) continue;
    for (const [duration, durationMs] of gaps) {
      if (requestedDuration && duration !== requestedDuration) continue;
      const releaseTarget = duration === "8 hours";
      const coldRuns = releaseTarget ? 10 : 1;
      const warmRuns = releaseTarget ? 10 : duration === "30 days" ? 1 : 3;
      const common = {
        fixtureId: `${id}-${checkpoint}`,
        fixtureVersion: "finished-1",
        elapsedMs: durationMs,
        definition,
        createGame: () => createGame(definition, { snapshot: initial }),
        advancement: {
          mode: "exact" as const,
          limits: { maximumWork: 200_000, maximumBulkBatches: 20_000 },
          capabilities,
        },
        now: () => performance.now(),
      };
      workloads.push({
        scenario: id,
        checkpoint,
        duration,
        durationMs,
        cold: profileAdvancement({ ...common, label: "cold", repetitions: coldRuns }),
        warm: profileAdvancement({ ...common, label: "warm", repetitions: warmRuns }),
      });
    }
  }
}

function decoded<N>(codec: SaveCodec<N>, id: GameId): Checkpoints<N> {
  const encoded = checkpointFile.checkpoints[id];
  return {
    beginning: codec.decode(encoded.beginning).snapshot,
    middle: codec.decode(encoded.middle).snapshot,
    ending: codec.decode(encoded.ending).snapshot,
  };
}

interface CheckpointFile {
  readonly checkpoints: Record<GameId, Record<keyof Checkpoints<never>, string>>;
}

type GameId = "wireworks" | "cascade" | "hearth";

interface Checkpoints<N> {
  readonly beginning: Snapshot<N>;
  readonly middle: Snapshot<N>;
  readonly ending: Snapshot<N>;
}

type Entries<T> = { [K in keyof T]-?: [K, T[K]] }[keyof T][];

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
const suffix = requestedGame
  ? `-${requestedGame}${requestedCheckpoint ? `-${requestedCheckpoint}` : ""}${requestedDuration ? `-${requestedDuration.replaceAll(" ", "-")}` : ""}`
  : "";
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(
    new URL(`workloads${suffix}.json`, output),
    `${JSON.stringify({ schema: "e308-workloads", schemaVersion: 1, machine, workloads }, null, 2)}\n`,
  ),
  writeFile(new URL(`workloads${suffix}.md`, output), workloadMarkdown(machine, workloads)),
]);
