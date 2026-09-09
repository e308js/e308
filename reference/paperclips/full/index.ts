import { createGame, type Game, type Snapshot } from "../../../packages/core/src/index.js";
import { paperclipsCommand } from "./commands.js";
import { paperclipsDefinition } from "./model.js";
import type { PaperclipsIntent } from "./types.js";

export * from "./commands.js";
export * from "./model.js";
export * from "./project-source-map.js";
export * from "./projects.js";
export * from "./purchase-curves.js";
export * from "./scenario.js";
export * from "./types.js";

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
}

export function createPaperclipsReference(): PaperclipsReferenceGame {
  return new PaperclipsReferenceGame();
}
