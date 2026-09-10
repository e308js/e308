import {
  type CatchupExecution,
  createGame,
  type GameDefinition,
  type SaveCodec,
  type Snapshot,
} from "@e308/core";
import { beginCatchup, processCatchupChunk, resolveEntitlement } from "@e308/core/offline";
import {
  cascadeCatchupExecution,
  cascadeDefinition,
  cascadeSaveCodec,
  cascadeScenario,
} from "@e308/game-cascade";
import { hearthDefinition, hearthSaveCodec, hearthScenario } from "@e308/game-hearth";
import { wireworksDefinition, wireworksSaveCodec, wireworksScenario } from "@e308/game-wireworks";
import { describe, expect, it } from "vitest";
import { driveScenario } from "../helpers/finished-games.js";

const gaps = [0, 60_000, 60 * 60_000, 8 * 60 * 60_000, 24 * 60 * 60_000, 30 * 24 * 60 * 60_000];
const workSteps = 10_000;

describe("finished-game offline matrix", () => {
  it("accounts every checkpoint, gap, and entitlement without dropping time", () => {
    verifyMatrix("wireworks", wireworksDefinition, wireworksSaveCodec, wireworksCheckpoints());
    verifyMatrix(
      "cascade",
      cascadeDefinition,
      cascadeSaveCodec,
      cascadeCheckpoints(),
      cascadeCatchupExecution,
    );
    verifyMatrix("hearth", hearthDefinition, hearthSaveCodec, hearthCheckpoints());
  }, 90_000);

  it("resumes interrupted eight-hour sessions exactly for every game", () => {
    verifyResume(wireworksDefinition, wireworksSaveCodec, middle(wireworksCheckpoints()));
    verifyResume(
      cascadeDefinition,
      cascadeSaveCodec,
      middle(cascadeCheckpoints()),
      cascadeCatchupExecution,
    );
    verifyResume(hearthDefinition, hearthSaveCodec, middle(hearthCheckpoints()));
  }, 30_000);
});

function verifyMatrix<N>(
  name: string,
  definition: GameDefinition<N>,
  codec: SaveCodec<N>,
  checkpoints: readonly Snapshot<N>[],
  execution?: CatchupExecution<N>,
): void {
  for (const [checkpointIndex, snapshot] of checkpoints.entries()) {
    for (const gap of gaps) {
      for (const policy of policies(snapshot)) {
        const entitlement = resolveEntitlement(policy, snapshot);
        const raw = codec.encode(snapshot, {
          wallAnchorMs: 1_000,
          entitlement,
          catchup: null,
        });
        const started = beginCatchup(
          definition,
          codec.decode(raw),
          1_000 + gap,
          `${name}:${checkpointIndex}:${gap}:${policy.policyVersion}`,
        );
        if (!started.catchup) throw new TypeError("catch-up session was not created");
        const game = createGame(definition, { snapshot: started.snapshot });
        const result = processCatchupChunk(definition, game, started.catchup, workSteps, execution);
        const eligible = entitlement.enabled
          ? entitlement.capMs === null
            ? gap
            : Math.min(gap, entitlement.capMs)
          : 0;
        const processed = Math.min(eligible, workSteps * definition.stepMs);
        const session = result.ok ? result.value.session : result.error.session;
        expect(session.eligibleRealMs, `${name}/${checkpointIndex}/${gap}`).toBe(eligible);
        expect(session.processedRealMs).toBe(processed);
        expect(session.pendingRealMs).toBe(eligible - processed);
        expect(session.processedRealMs + session.pendingRealMs).toBe(session.eligibleRealMs);
        expect(game.getSnapshot().gameTimeMs).toBe(snapshot.gameTimeMs + processed);
      }
    }
  }
}

function verifyResume<N>(
  definition: GameDefinition<N>,
  codec: SaveCodec<N>,
  snapshot: Snapshot<N>,
  execution?: CatchupExecution<N>,
): void {
  const duration = 8 * 60 * 60_000;
  const entitlement = resolveEntitlement(
    {
      policyVersion: "resume-unlimited",
      enabled: true,
      cap: { kind: "unlimited" },
      excess: "discard",
    },
    snapshot,
  );
  const initial = codec.decode(
    codec.encode(snapshot, { wallAnchorMs: 10_000, entitlement, catchup: null }),
  );
  const started = beginCatchup(definition, initial, 10_000 + duration, "resume");
  if (!started.catchup) throw new TypeError("catch-up session was not created");
  const interrupted = createGame(definition, { snapshot });
  const first = processCatchupChunk(definition, interrupted, started.catchup, 1_000, execution);
  if (first.ok) throw new TypeError("first bounded chunk unexpectedly completed");
  const persisted = codec.decode(
    codec.encode(first.error.snapshot, {
      wallAnchorMs: started.wallAnchorMs,
      entitlement,
      catchup: first.error.session,
    }),
  );
  if (!persisted.catchup) throw new TypeError("persisted catch-up session was not restored");
  const resumed = createGame(definition, { snapshot: persisted.snapshot });
  const second = processCatchupChunk(
    definition,
    resumed,
    persisted.catchup,
    Math.ceil(duration / definition.stepMs),
    execution,
  );
  expect(second.ok).toBe(true);
  const uninterrupted = createGame(definition, { snapshot });
  if (execution?.kind === "optimized") {
    const advanced = execution.advance(
      uninterrupted,
      duration,
      Math.ceil(duration / definition.stepMs),
    );
    expect(advanced.status).toBe("completed");
  } else uninterrupted.advance(duration);
  expect(withoutRevision(resumed.getSnapshot())).toEqual(
    withoutRevision(uninterrupted.getSnapshot()),
  );
}

function policies<N>(snapshot: Snapshot<N>) {
  return [
    {
      policyVersion: "disabled",
      enabled: false,
      cap: { kind: "unlimited" as const },
      excess: "discard" as const,
    },
    {
      policyVersion: "fixed-eight-hours",
      enabled: true,
      cap: { kind: "duration" as const, milliseconds: 8 * 60 * 60_000 },
      excess: "bank" as const,
    },
    {
      policyVersion: "dynamic",
      enabled: true,
      cap: {
        kind: "dynamic" as const,
        resolve: () => (snapshot.progression.won ? 24 * 60 * 60_000 : 60 * 60_000),
      },
      excess: "discard" as const,
    },
    {
      policyVersion: "unlimited",
      enabled: true,
      cap: { kind: "unlimited" as const },
      excess: "discard" as const,
    },
  ];
}

function wireworksCheckpoints() {
  const scenario = wireworksScenario();
  return [
    scenario.create("aa").getSnapshot(),
    driveScenario(scenario, {
      cadenceMs: 20_000,
      maximumDecisions: 1_000,
      stop: (snapshot) => Boolean(snapshot.progression.upgrades["autonomous-control"]),
    }).getSnapshot(),
    driveScenario(scenario, {
      cadenceMs: 20_000,
      maximumDecisions: 2_000,
      stop: (snapshot) => snapshot.progression.won,
    }).getSnapshot(),
  ];
}

function cascadeCheckpoints() {
  const scenario = cascadeScenario();
  return [
    scenario.create("aa").getSnapshot(),
    driveScenario(scenario, {
      cadenceMs: 60_000,
      maximumDecisions: 1_000,
      stop: (snapshot) => snapshot.progression.activeChallenges.length > 0,
    }).getSnapshot(),
    driveScenario(scenario, {
      cadenceMs: 60_000,
      maximumDecisions: 5_000,
      stop: (snapshot) => snapshot.progression.won,
    }).getSnapshot(),
  ];
}

function hearthCheckpoints() {
  const scenario = hearthScenario();
  return [
    scenario.create("aa").getSnapshot(),
    driveScenario(scenario, {
      cadenceMs: 1_000,
      maximumDecisions: 2_000,
      stop: (snapshot) => Boolean(snapshot.progression.achievements["year-complete"]),
    }).getSnapshot(),
    driveScenario(scenario, {
      cadenceMs: 1_000,
      maximumDecisions: 3_000,
      stop: (snapshot) => snapshot.progression.won,
    }).getSnapshot(),
  ];
}

function withoutRevision<N>(snapshot: Snapshot<N>): Snapshot<N> {
  return { ...snapshot, revision: 0n };
}

function middle<N>(checkpoints: readonly Snapshot<N>[]): Snapshot<N> {
  const checkpoint = checkpoints[1];
  if (!checkpoint) throw new TypeError("middle checkpoint was not produced");
  return checkpoint;
}
