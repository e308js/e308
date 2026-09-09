import type { GameDefinition } from "../model/definition.js";
import { type CatchupExecution, processCatchupChunk } from "../offline/processor.js";
import { acknowledgeCatchup, beginCatchup } from "../offline/session.js";
import type { CatchupSession, LoadedCheckpoint } from "../persistence/types.js";
import { createGame } from "../state/game.js";
import type { ReconciledCheckpoint } from "./types.js";

export function reconcileCheckpoint<N>(options: {
  readonly definition: GameDefinition<N>;
  readonly checkpoint: LoadedCheckpoint<N>;
  readonly nowMs: number;
  readonly sessionId: string;
  readonly maximumSteps: number;
  readonly execution?: CatchupExecution<N>;
}): ReconciledCheckpoint<N> {
  const started = beginCatchup(
    options.definition,
    options.checkpoint,
    options.nowMs,
    options.sessionId,
  );
  if (started.clockAnomaly) {
    return {
      checkpoint: options.checkpoint,
      elapsedRealMs: 0,
      advancedGameMs: 0,
      clockAnomaly: started.clockAnomaly,
    };
  }
  const originalGameMs = started.snapshot.gameTimeMs;
  let snapshot = started.snapshot;
  if (!started.catchup) return { checkpoint: started, elapsedRealMs: 0, advancedGameMs: 0 };
  let session: CatchupSession = started.catchup;
  while (session.pendingRealMs > 0) {
    const result = processCatchupChunk(
      options.definition,
      createGame(options.definition, { snapshot }),
      session,
      options.maximumSteps,
      options.execution,
    );
    if (!result.ok && result.error.code === "simulation-failed")
      throw new TypeError("Offline simulation failed");
    snapshot = result.ok ? result.value.snapshot : result.error.snapshot;
    session = result.ok ? result.value.session : result.error.session;
  }
  const completed = acknowledgeCatchup({ ...started, snapshot, catchup: session });
  return {
    checkpoint: completed,
    elapsedRealMs: session.report.elapsedRealMs,
    advancedGameMs: snapshot.gameTimeMs - originalGameMs,
  };
}
