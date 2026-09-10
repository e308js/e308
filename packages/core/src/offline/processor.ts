import type { GameDefinition } from "../model/definition.js";
import type { CatchupSegment, CatchupSession, OfflineReport } from "../persistence/types.js";
import type { Game, Result, Snapshot, Transaction } from "../state/types.js";

export type CatchupExecution<N> =
  | { readonly kind: "canonical" }
  | {
      readonly kind: "optimized";
      readonly advance: (
        game: Game<N>,
        pendingRealMs: number,
        maximumWork: number,
      ) => {
        readonly status: "completed" | "pending" | "failed";
        readonly snapshot: Snapshot<N>;
        readonly processedRealMs: number;
        readonly fidelity: "canonical" | "validated-bulk" | "approximate";
      };
    }
  | {
      readonly kind: "custom-reward";
      readonly apply: (transaction: Transaction<N>, advancedGameMs: number) => void;
    };

export type CatchupChunkResult<N> = Result<
  { readonly snapshot: Snapshot<N>; readonly session: CatchupSession; readonly complete: boolean },
  {
    readonly code: "budget-exceeded" | "simulation-failed";
    readonly snapshot: Snapshot<N>;
    readonly session: CatchupSession;
  }
>;

export function processCatchupChunk<N>(
  definition: GameDefinition<N>,
  game: Game<N>,
  session: CatchupSession,
  maximumSteps: number,
  execution: CatchupExecution<N> | undefined = undefined,
): CatchupChunkResult<N> {
  const selected = execution ?? { kind: "canonical" };
  if (!Number.isSafeInteger(maximumSteps) || maximumSteps < 1)
    throw new TypeError("Catch-up work budget must be a positive safe integer");
  if (session.pendingRealMs === 0)
    return { ok: true, value: { snapshot: game.getSnapshot(), session, complete: true } };
  if (
    session.processedRealMs > 0 &&
    selected.kind !== "optimized" &&
    session.report.fidelity !== selected.kind
  )
    throw new TypeError("Catch-up execution policy cannot change after processing begins");
  const before = game.getSnapshot();
  const attempt = advanceCatchup(
    definition,
    game,
    before,
    session.pendingRealMs,
    maximumSteps,
    selected,
  );
  const advanced = attempt.result;
  if (!advanced.ok) {
    const failed = withStop(session, "error");
    return { ok: false, error: { code: "simulation-failed", snapshot: before, session: failed } };
  }
  const processed = session.processedRealMs + attempt.processedRealMs;
  const pending = session.eligibleRealMs - processed;
  const segments = addSegment(
    session.segments,
    definition.simulationVersion,
    attempt.processedRealMs,
  );
  const report = updateReport(
    definition,
    session.report,
    before,
    advanced.value,
    processed,
    pending,
    combinedFidelity(session, attempt.fidelity),
  );
  const next = Object.freeze({
    ...session,
    processedRealMs: processed,
    pendingRealMs: pending,
    segments,
    report,
  });
  if (pending > 0)
    return {
      ok: false,
      error: {
        code: "budget-exceeded",
        snapshot: advanced.value,
        session: withStop(next, "budget-exceeded"),
      },
    };
  return { ok: true, value: { snapshot: advanced.value, session: next, complete: true } };
}

function advanceCatchup<N>(
  definition: GameDefinition<N>,
  game: Game<N>,
  before: Snapshot<N>,
  pendingRealMs: number,
  maximumWork: number,
  execution: CatchupExecution<N>,
) {
  if (execution.kind === "optimized") {
    const result = execution.advance(game, pendingRealMs, maximumWork);
    if (
      result.snapshot !== game.getSnapshot() ||
      !Number.isSafeInteger(result.processedRealMs) ||
      result.processedRealMs < 0 ||
      result.processedRealMs > pendingRealMs ||
      (result.status === "completed" && result.processedRealMs !== pendingRealMs) ||
      (result.status === "pending" && result.processedRealMs === 0) ||
      (result.status === "failed" && result.snapshot !== before)
    )
      throw new TypeError("Optimized catch-up returned an invalid advancement result");
    if (result.status === "failed" && result.processedRealMs !== 0)
      throw new TypeError("Failed optimized catch-up must be atomic");
    return {
      result:
        result.status === "failed"
          ? ({ ok: false } as const)
          : ({ ok: true, value: result.snapshot } as const),
      processedRealMs: result.processedRealMs,
      fidelity: result.fidelity,
    };
  }
  const duration = Math.min(pendingRealMs, maximumWork * definition.stepMs);
  const result =
    execution.kind === "canonical"
      ? game.advance(duration)
      : game.advanceCustom(duration, execution.apply);
  return { result, processedRealMs: duration, fidelity: execution.kind };
}

function combinedFidelity(
  session: CatchupSession,
  next: OfflineReport["fidelity"],
): OfflineReport["fidelity"] {
  if (session.processedRealMs === 0) return next;
  const previous = session.report.fidelity;
  if (previous === "custom-reward" || next === "custom-reward") {
    if (previous !== next) throw new TypeError("Catch-up execution policy cannot change");
    return next;
  }
  if (previous === "approximate" || next === "approximate") return "approximate";
  if (previous === "validated-bulk" || next === "validated-bulk") return "validated-bulk";
  return "canonical";
}

export function cancelCatchup(session: CatchupSession): CatchupSession {
  return withStop(session, "cancelled");
}

export function discardPendingTime(session: CatchupSession): CatchupSession {
  const eligible = session.processedRealMs;
  const discarded = session.discardedRealMs + session.pendingRealMs;
  return Object.freeze({
    ...session,
    eligibleRealMs: eligible,
    pendingRealMs: 0,
    discardedRealMs: discarded,
    report: {
      ...session.report,
      eligibleRealMs: eligible,
      pendingRealMs: 0,
      discardedRealMs: discarded,
      stopReason: "cancelled" as const,
    },
  });
}

function addSegment(
  segments: readonly CatchupSegment[],
  simulationVersion: number,
  duration: number,
): readonly CatchupSegment[] {
  const last = segments.at(-1);
  if (last?.simulationVersion === simulationVersion)
    return Object.freeze([
      ...segments.slice(0, -1),
      { simulationVersion, processedRealMs: last.processedRealMs + duration },
    ]);
  return Object.freeze([...segments, { simulationVersion, processedRealMs: duration }]);
}

function updateReport<N>(
  definition: GameDefinition<N>,
  report: OfflineReport,
  before: Snapshot<N>,
  after: Snapshot<N>,
  processed: number,
  pending: number,
  fidelity: OfflineReport["fidelity"],
): OfflineReport {
  const numbers = definition.numbers;
  if (!numbers) throw new TypeError("Game definition has no numeric adapter");
  return {
    ...report,
    processedRealMs: processed,
    pendingRealMs: pending,
    fidelity,
    advancedGameMs: report.advancedGameMs + after.gameTimeMs - before.gameTimeMs,
    resources: report.resources.map((resource) => ({
      ...resource,
      after: numbers.codec.serialize(after.resources[resource.id] as N),
      produced: numbers.codec.serialize(
        numbers.add(
          resource.produced ? numbers.codec.parse(resource.produced) : numbers.fromNumber(0),
          numbers.sub(
            after.productionTotals[resource.id] as N,
            before.productionTotals[resource.id] as N,
          ),
        ),
      ),
    })),
    progression: [...report.progression, ...progressionEvents(report.sessionId, before, after)],
  };
}

function progressionEvents<N>(
  sessionId: string,
  before: Snapshot<N>,
  after: Snapshot<N>,
): OfflineReport["progression"] {
  const previous = before.progression.events.at(-1)?.sequence ?? 0n;
  return after.progression.events
    .filter((event) => event.sequence > previous)
    .map((event) => ({
      eventId: `${sessionId}:${event.sequence}`,
      kind: event.kind,
      id: event.id,
      atGameMs: event.atGameMs,
    }));
}

function withStop(session: CatchupSession, stopReason: NonNullable<OfflineReport["stopReason"]>) {
  return Object.freeze({ ...session, report: { ...session.report, stopReason } });
}
