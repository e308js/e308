import type { GameDefinition } from "../model/definition.js";
import type { CatchupSession, LoadedCheckpoint, OfflineReport } from "../persistence/types.js";

export interface CatchupStart<N> extends LoadedCheckpoint<N> {
  readonly clockAnomaly?: { readonly anchorMs: number; readonly observedMs: number };
}

export function beginCatchup<N>(
  definition: GameDefinition<N>,
  checkpoint: LoadedCheckpoint<N>,
  nowMs: number,
  sessionId: string,
): CatchupStart<N> {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new TypeError("Return time is invalid");
  if (!sessionId) throw new TypeError("Catch-up session ID is required");
  if (checkpoint.catchup) return checkpoint;
  if (nowMs < checkpoint.wallAnchorMs) {
    return {
      ...checkpoint,
      clockAnomaly: { anchorMs: checkpoint.wallAnchorMs, observedMs: nowMs },
    };
  }
  const elapsed = nowMs - checkpoint.wallAnchorMs;
  const cap = checkpoint.entitlement.enabled ? checkpoint.entitlement.capMs : 0;
  const eligible = cap === null ? elapsed : Math.min(elapsed, cap);
  const excess = elapsed - eligible;
  const banked =
    checkpoint.entitlement.enabled && checkpoint.entitlement.excess === "bank" ? excess : 0;
  const discarded = excess - banked;
  const resources = Object.entries(checkpoint.snapshot.resources).map(([id, value]) => ({
    id,
    before: encode(definition, value),
    after: encode(definition, value),
  }));
  const report: OfflineReport = {
    sessionId,
    elapsedRealMs: elapsed,
    eligibleRealMs: eligible,
    processedRealMs: 0,
    pendingRealMs: eligible,
    discardedRealMs: discarded,
    bankedRealMs: banked,
    advancedGameMs: 0,
    fidelity: "canonical",
    resources,
    progression: [],
  };
  const catchup: CatchupSession = {
    sessionId,
    startWallMs: checkpoint.wallAnchorMs,
    endWallMs: nowMs,
    entitlement: checkpoint.entitlement,
    eligibleRealMs: eligible,
    processedRealMs: 0,
    pendingRealMs: eligible,
    discardedRealMs: discarded,
    bankedRealMs: banked,
    segments: [],
    report,
    deliveryCursor: checkpoint.lastDeliveredEvent,
  };
  return { ...checkpoint, wallAnchorMs: nowMs, catchup };
}

export function acknowledgeCatchup<N>(checkpoint: LoadedCheckpoint<N>): LoadedCheckpoint<N> {
  const session = checkpoint.catchup;
  if (!session) return checkpoint;
  if (session.pendingRealMs !== 0)
    throw new TypeError("Cannot acknowledge catch-up while eligible time remains pending");
  const lastSequence = checkpoint.snapshot.progression.events.at(-1)?.sequence;
  return {
    ...checkpoint,
    catchup: null,
    lastDeliveredEvent: lastSequence?.toString() ?? checkpoint.lastDeliveredEvent,
  };
}

function encode<N>(definition: GameDefinition<N>, value: N): string {
  if (!definition.numbers) throw new TypeError("Game definition has no numeric adapter");
  return definition.numbers.codec.serialize(value);
}
