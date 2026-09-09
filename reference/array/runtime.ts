import {
  createGame,
  createSaveCodec,
  type Game,
  type Snapshot,
} from "../../packages/core/src/index.js";
import type { WorkerTransferCodec } from "../../packages/core/src/worker/index.js";
import { type ArrayIntent, arrayCommand } from "./commands.js";
import { arrayDefinition } from "./definition.js";
import type { ArrayQuantity } from "./math.js";
import { updateArrayEconomy } from "./production.js";

export const arraySaveCodec = createSaveCodec(arrayDefinition, {
  stateSchemaVersion: 1,
  contentVersion: "0.4.2-a-b",
  contentDigest: "array-game-a-b-reference-2026-09-09",
});

const offlineEntitlement = Object.freeze({
  policyVersion: "array-reference-offline-1",
  enabled: true,
  capMs: null,
  excess: "discard" as const,
});

export const arrayWorkerCodec: WorkerTransferCodec<ArrayQuantity, ArrayIntent, string> = {
  encodeSnapshot: (snapshot) =>
    arraySaveCodec.encode(snapshot, {
      wallAnchorMs: 0,
      entitlement: offlineEntitlement,
      catchup: null,
    }),
  decodeSnapshot: (raw) => arraySaveCodec.decode(raw).snapshot,
  decodeIntent: (intent) => arrayCommand(intent),
};

export function createArrayReference(snapshot?: Snapshot<ArrayQuantity>) {
  const game = createGame(arrayDefinition, snapshot ? { snapshot } : {});
  return {
    game,
    getSnapshot: () => game.getSnapshot(),
    advance: (milliseconds: number) => game.advance(milliseconds),
    advanceAway: (milliseconds: number) => advanceArrayAway(game, milliseconds),
    dispatch: (intent: ArrayIntent) => game.dispatch(arrayCommand(intent)),
    exportSave: (wallAnchorMs: number) =>
      arraySaveCodec.encode(game.getSnapshot(), {
        wallAnchorMs,
        entitlement: offlineEntitlement,
        catchup: null,
      }),
  };
}

export function importArrayReference(raw: string) {
  return createArrayReference(arraySaveCodec.decode(raw).snapshot);
}

export function advanceArrayAway(game: Game<ArrayQuantity>, milliseconds: number) {
  return game.advanceCustom(milliseconds, (transaction, advancedGameMs) => {
    updateArrayEconomy(transaction, advancedGameMs / 1_000);
  });
}
