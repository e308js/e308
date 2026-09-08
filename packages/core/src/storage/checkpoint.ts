import type { GameDefinition } from "../model/definition.js";
import { type CatchupExecution, processCatchupChunk } from "../offline/processor.js";
import { beginCatchup } from "../offline/session.js";
import type { SaveCodec } from "../persistence/codec.js";
import { createGame } from "../state/game.js";
import type { TransactionalSaveStore } from "./store.js";

export interface CatchupCommitResult {
  readonly storageRevision: string;
  readonly sessionId: string;
  readonly pendingRealMs: number;
  readonly complete: boolean;
}

export async function commitCatchupChunk<N>(options: {
  readonly store: TransactionalSaveStore;
  readonly slot: string;
  readonly codec: SaveCodec<N>;
  readonly definition: GameDefinition<N>;
  readonly nowMs: number;
  readonly sessionId: string;
  readonly maximumSteps: number;
  readonly execution?: CatchupExecution<N>;
}): Promise<CatchupCommitResult> {
  const stored = await options.store.read(options.slot);
  if (!stored) throw new TypeError(`No save exists in slot ${options.slot}`);
  const checkpoint = options.codec.decode(stored.value);
  const started = beginCatchup(options.definition, checkpoint, options.nowMs, options.sessionId);
  if (started.clockAnomaly) throw new TypeError("Wall clock moved behind the saved anchor");
  const game = createGame(options.definition, { snapshot: started.snapshot });
  const result = processCatchupChunk(
    options.definition,
    game,
    started.catchup as NonNullable<typeof started.catchup>,
    options.maximumSteps,
    options.execution,
  );
  const snapshot = result.ok ? result.value.snapshot : result.error.snapshot;
  const session = result.ok ? result.value.session : result.error.session;
  const value = options.codec.encode(snapshot, {
    wallAnchorMs: started.wallAnchorMs,
    entitlement: started.entitlement,
    catchup: session,
    migrationLedger: started.migrationLedger,
    lastDeliveredEvent: started.lastDeliveredEvent,
  });
  const written = await options.store.compareAndSwap(options.slot, stored.revision, value);
  if (!written.ok) throw new TypeError("Save slot changed during catch-up commit");
  return {
    storageRevision: written.revision,
    sessionId: session.sessionId,
    pendingRealMs: session.pendingRealMs,
    complete: session.pendingRealMs === 0,
  };
}
