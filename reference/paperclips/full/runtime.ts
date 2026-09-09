import {
  createGame,
  createSaveCodec,
  type Game,
  type Snapshot,
} from "../../../packages/core/src/index.js";
import type { WorkerTransferCodec } from "../../../packages/core/src/worker/index.js";
import { paperclipsCommand } from "./commands.js";
import { paperclipsDefinition } from "./model.js";
import type { PaperclipsIntent } from "./types.js";

export const paperclipsSaveCodec = createSaveCodec(paperclipsDefinition, {
  stateSchemaVersion: 1,
  contentVersion: "0.5.0-complete-projects",
  contentDigest: "paperclips-reference-complete-projects-2026-09-09",
});

const offlineEntitlement = Object.freeze({
  policyVersion: "paperclips-reference-offline-1",
  enabled: true,
  capMs: null,
  excess: "discard" as const,
});

export const paperclipsWorkerCodec: WorkerTransferCodec<number, PaperclipsIntent, string> = {
  encodeSnapshot: (snapshot) =>
    paperclipsSaveCodec.encode(snapshot, {
      wallAnchorMs: 0,
      entitlement: offlineEntitlement,
      catchup: null,
    }),
  decodeSnapshot: (raw) => paperclipsSaveCodec.decode(raw).snapshot,
  decodeIntent: (intent, snapshot) => paperclipsCommand(snapshot, intent),
};

export class PaperclipsReferenceGame {
  constructor(readonly game: Game<number> = createGame(paperclipsDefinition)) {}

  getSnapshot(): Snapshot<number> {
    return this.game.getSnapshot();
  }

  dispatch(intent: PaperclipsIntent) {
    return this.game.dispatch(paperclipsCommand(this.getSnapshot(), intent));
  }

  advance(milliseconds: number) {
    return this.game.advance(milliseconds);
  }

  advanceAway(milliseconds: number) {
    return this.game.advance(milliseconds);
  }

  exportSave(wallAnchorMs: number): string {
    return paperclipsSaveCodec.encode(this.game.getSnapshot(), {
      wallAnchorMs,
      entitlement: offlineEntitlement,
      catchup: null,
    });
  }
}

export function createPaperclipsReference(snapshot?: Snapshot<number>): PaperclipsReferenceGame {
  return new PaperclipsReferenceGame(
    createGame(paperclipsDefinition, snapshot ? { snapshot } : {}),
  );
}

export function importPaperclipsReference(raw: string): PaperclipsReferenceGame {
  return createPaperclipsReference(paperclipsSaveCodec.decode(raw).snapshot);
}
