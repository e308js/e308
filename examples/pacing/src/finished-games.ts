import type { SaveCodec, Snapshot } from "@e308/core";
import {
  type BotPolicy,
  goalPolicy,
  type HarnessReport,
  type HarnessScenario,
  type HarnessValue,
  rankedPolicy,
  runHarness,
} from "@e308/core/testing";
import { cascadeSaveCodec, cascadeScenario } from "@e308/game-cascade";
import { hearthSaveCodec, hearthScenario } from "@e308/game-hearth";
import { wireworksSaveCodec, wireworksScenario } from "@e308/game-wireworks";
import { writeReportSet } from "./write-reports.js";

const reports: HarnessReport[] = [];
runCatalog(wireworksScenario(), "final-expansion", 12 * 60 * 60_000, 20_000);
runCatalog(cascadeScenario(), "final-research", 72 * 60 * 60_000, 60_000);
runCatalog(hearthScenario(), "great-hall", 36 * 60_000, 1_000);

const output = new URL("../../../artifacts/finished-games/", import.meta.url);
const checkpoints = {
  wireworks: checkpointSet(wireworksScenario(), wireworksSaveCodec, 20_000, (snapshot) =>
    Boolean(snapshot.progression.upgrades["autonomous-control"]),
  ),
  cascade: checkpointSet(
    cascadeScenario(),
    cascadeSaveCodec,
    60_000,
    (snapshot) => snapshot.progression.activeChallenges.length > 0,
  ),
  hearth: checkpointSet(hearthScenario(), hearthSaveCodec, 1_000, (snapshot) =>
    Boolean(snapshot.progression.achievements["year-complete"]),
  ),
};
await writeReportSet({
  output,
  reports,
  fileName: (report) => `${report.scenarioId}-${report.policy.id}-${scheduleId(report)}.md`,
  extras: [
    {
      name: "checkpoints.json",
      contents: `${JSON.stringify({ schema: "e308-finished-checkpoints", schemaVersion: 1, checkpoints }, null, 2)}\n`,
    },
  ],
});

function runCatalog<N, O extends HarnessValue, I extends HarnessValue>(
  scenario: HarnessScenario<N, O, I>,
  goalId: string,
  horizon: number,
  cadence: number,
): void {
  const policies: BotPolicy<O, I>[] = [
    firstLegalPolicy(),
    rankedPolicy({ id: "ranked", version: "finished-1" }),
    goalPolicy({
      id: "goal",
      version: "finished-1",
      score: (_context, quote) => (quote.rank ?? 0) + (quote.id.includes("final") ? 1_000 : 0),
    }),
  ];
  const schedules = [
    { id: "active", value: [{ kind: "active" as const, durationMs: horizon }] },
    {
      id: "intermittent",
      value: [
        { kind: "active" as const, durationMs: Math.floor(horizon / 3) },
        { kind: "idle-open" as const, durationMs: Math.floor(horizon / 6) },
        { kind: "active" as const, durationMs: horizon },
      ],
    },
    {
      id: "long-absence",
      value: [
        { kind: "active" as const, durationMs: Math.floor(horizon / 3) },
        { kind: "absent" as const, durationMs: 8 * 60 * 60_000 },
        { kind: "active" as const, durationMs: horizon },
      ],
    },
  ];
  for (const policy of policies) {
    for (const schedule of schedules) {
      reports.push(
        runHarness({
          scenario,
          policy,
          goalId,
          schedule: schedule.value,
          decisionCadenceMs: cadence,
          gameSeed: "00",
          botSeed: "01",
          limits: {
            maximumDecisions: 20_000,
            maximumTraceEntries: 2_000,
            maximumSamples: 300,
            sampleCadenceMs: Math.max(cadence, 60_000),
          },
          replayCommand: `pnpm report:finished-games -- ${scenario.id} ${policy.id} ${schedule.id}`,
        }),
      );
    }
  }
}

function firstLegalPolicy<O extends HarnessValue, I extends HarnessValue>(): BotPolicy<O, I> {
  return {
    id: "scripted",
    version: "finished-1",
    decide: ({ quotes }) => {
      const quote = quotes.find((candidate) => candidate.legal && candidate.useful);
      return quote
        ? { kind: "action", actionId: quote.id }
        : { kind: "wait", reason: "script-wait" };
    },
  };
}

function scheduleId(report: HarnessReport): string {
  return report.schedule.some((segment) => segment.kind === "absent")
    ? "long-absence"
    : report.schedule.some((segment) => segment.kind === "idle-open")
      ? "intermittent"
      : "active";
}

function checkpointSet<N, O extends HarnessValue, I extends HarnessValue>(
  scenario: HarnessScenario<N, O, I>,
  codec: SaveCodec<N>,
  cadenceMs: number,
  middle: (snapshot: Snapshot<N>) => boolean,
) {
  const beginning = scenario.create("00").getSnapshot();
  const middleSnapshot = drive(scenario, cadenceMs, middle);
  const ending = drive(scenario, cadenceMs, (snapshot) => snapshot.progression.won);
  return {
    beginning: encodedCheckpoint(codec, beginning),
    middle: encodedCheckpoint(codec, middleSnapshot),
    ending: encodedCheckpoint(codec, ending),
  };
}

function drive<N, O extends HarnessValue, I extends HarnessValue>(
  scenario: HarnessScenario<N, O, I>,
  cadenceMs: number,
  stop: (snapshot: Snapshot<N>) => boolean,
): Snapshot<N> {
  const game = scenario.create("00");
  for (let decision = 0; decision < 20_000 && !stop(game.getSnapshot()); decision += 1) {
    const quote = scenario.quote(game.getSnapshot()).find((entry) => entry.legal && entry.useful);
    if (quote) game.dispatch(scenario.command(quote.intent, game.getSnapshot()));
    game.advance(cadenceMs);
  }
  if (!stop(game.getSnapshot())) throw new TypeError(`${scenario.id} checkpoint was unreachable`);
  return game.getSnapshot();
}

function encodedCheckpoint<N>(codec: SaveCodec<N>, snapshot: Snapshot<N>): string {
  return codec.encode(snapshot, {
    wallAnchorMs: 1_000_000,
    entitlement: {
      policyVersion: "finished-checkpoint-1",
      enabled: true,
      capMs: null,
      excess: "bank",
    },
    catchup: null,
  });
}
