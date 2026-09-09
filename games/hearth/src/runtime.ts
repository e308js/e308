import {
  allocationCommand,
  type Command,
  type CommandFailure,
  createGame,
  createSaveCodec,
  type Game,
  queueTaskCommand,
  recipeCommand,
  type Snapshot,
  upgradeCommand,
} from "@e308/core";
import { GameViewSource } from "@e308/ux";
import { hearthJobs, hearthRecipes, hearthResearch, hearthTasks } from "./content.js";
import { hearthDefinition } from "./definition.js";

export type HearthJob = "farmer" | "woodcutter" | "miner" | "scholar";
export type HearthRecipe = keyof typeof hearthRecipes;
export type HearthTask = keyof typeof hearthTasks;
export type HearthIntent =
  | { readonly type: "advance"; readonly milliseconds: number }
  | { readonly type: "allocate"; readonly job: HearthJob; readonly amount: number }
  | { readonly type: "recipe"; readonly recipe: HearthRecipe; readonly count: number }
  | { readonly type: "research"; readonly id: string }
  | { readonly type: "task"; readonly task: HearthTask };
export type HearthActionIntent = Exclude<HearthIntent, { readonly type: "advance" }>;
export type HearthResult =
  | ReturnType<Game<number>["dispatch"]>
  | ReturnType<Game<number>["advance"]>;

export const hearthSaveCodec = createSaveCodec(hearthDefinition, {
  stateSchemaVersion: 1,
  contentVersion: "1.0.0",
  contentDigest: "hearth-1.0.0-2026-09-09",
});

export function createHearth(snapshot?: Snapshot<number>): HearthGame {
  return new HearthGame(createGame(hearthDefinition, snapshot ? { snapshot } : {}));
}

export function importHearth(raw: string): HearthGame {
  return createHearth(hearthSaveCodec.decode(raw).snapshot);
}

export class HearthGame extends GameViewSource<number, HearthIntent, HearthResult> {
  constructor(game: Game<number>) {
    super(game, (target, intent) =>
      intent.type === "advance"
        ? target.advance(intent.milliseconds)
        : target.dispatch(hearthCommand(intent)),
    );
  }

  exportSave(wallAnchorMs: number): string {
    return hearthSaveCodec.encode(this.game.getSnapshot(), {
      wallAnchorMs,
      entitlement: {
        policyVersion: "hearth-offline-1",
        enabled: true,
        capMs: 8 * 60 * 60_000,
        excess: "discard",
      },
      catchup: null,
    });
  }
}

export function hearthCommand(intent: HearthActionIntent): Command<number> {
  if (intent.type === "allocate") return allocationCommand(hearthJobs, intent.job, intent.amount);
  if (intent.type === "recipe")
    return recipeCommand(hearthRecipes[intent.recipe], { count: intent.count });
  if (intent.type === "task") return queueTaskCommand(hearthTasks[intent.task]);
  const research = hearthResearch.find((candidate) => candidate.id === intent.id);
  if (research) return upgradeCommand(research);
  return failureCommand(`research:${intent.id}`, { code: "invalid-target", id: intent.id });
}

function failureCommand(id: string, failure: CommandFailure<number>): Command<number> {
  return { id, execute: (transaction) => transaction.reject(failure) };
}
