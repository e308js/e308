import {
  type Command,
  type CommandFailure,
  completeChallengeCommand,
  createGame,
  createSaveCodec,
  type EternityQuantity,
  enterChallengeCommand,
  exitChallengeCommand,
  type Game,
  type Snapshot,
} from "@e308/core";
import { GameViewSource } from "@e308/ux";
import { cascadeDefinition } from "./definition.js";
import { buyDimensionCommand, cascadeKit } from "./economy.js";
import { cascadeChallenges, progressionCommand } from "./progression.js";

export type CascadeIntent =
  | { readonly type: "advance"; readonly milliseconds: number }
  | { readonly type: "buy"; readonly tier: number; readonly count: number }
  | { readonly type: "prestige"; readonly id: "collapse" | "condense" | "ascend" }
  | { readonly type: "challenge-enter"; readonly id: string }
  | { readonly type: "challenge-complete"; readonly id: string }
  | { readonly type: "challenge-exit"; readonly id: string }
  | {
      readonly type: "automation";
      readonly id: "dimension" | "collapse";
      readonly enabled: boolean;
    }
  | { readonly type: "research"; readonly target: "speed" | "retention"; readonly amount: number }
  | { readonly type: "respec" }
  | { readonly type: "final-research" };

export type CascadeActionIntent = Exclude<CascadeIntent, { readonly type: "advance" }>;
export type CascadeResult =
  | ReturnType<Game<EternityQuantity>["dispatch"]>
  | ReturnType<Game<EternityQuantity>["advance"]>;

export const cascadeSaveCodec = createSaveCodec(cascadeDefinition, {
  stateSchemaVersion: 1,
  contentVersion: "1.0.0",
  contentDigest: "cascade-1.0.0-2026-09-09",
});

export function createCascade(snapshot?: Snapshot<EternityQuantity>): CascadeGame {
  return new CascadeGame(createGame(cascadeDefinition, snapshot ? { snapshot } : {}));
}

export function importCascade(raw: string): CascadeGame {
  return createCascade(cascadeSaveCodec.decode(raw).snapshot);
}

export class CascadeGame extends GameViewSource<EternityQuantity, CascadeIntent, CascadeResult> {
  constructor(game: Game<EternityQuantity>) {
    super(game, (target, intent) =>
      intent.type === "advance"
        ? target.advance(intent.milliseconds)
        : target.dispatch(cascadeCommand(intent)),
    );
  }

  exportSave(wallAnchorMs: number): string {
    return cascadeSaveCodec.encode(this.game.getSnapshot(), {
      wallAnchorMs,
      entitlement: {
        policyVersion: "cascade-offline-1",
        enabled: true,
        capMs: null,
        excess: "bank",
      },
      catchup: null,
    });
  }
}

export function cascadeCommand(intent: CascadeActionIntent): Command<EternityQuantity> {
  if (intent.type === "buy") return buyDimensionCommand(intent.tier - 1, intent.count);
  if (intent.type === "challenge-enter") return challengeCommand(intent.id, "enter");
  if (intent.type === "challenge-complete") return challengeCommand(intent.id, "complete");
  if (intent.type === "challenge-exit") return challengeCommand(intent.id, "exit");
  if (intent.type === "research")
    return progressionCommand({ ...intent, amount: cascadeKit.q(intent.amount) });
  return progressionCommand(intent);
}

function challengeCommand(
  id: string,
  action: "enter" | "complete" | "exit",
): Command<EternityQuantity> {
  const challenge = cascadeChallenges.find((candidate) => candidate.id === id);
  if (!challenge) return failedCommand(`challenge:${action}:${id}`, { code: "invalid-target", id });
  if (action === "enter") return enterChallengeCommand(challenge, cascadeChallenges);
  if (action === "complete") return completeChallengeCommand(challenge);
  return exitChallengeCommand(challenge);
}

function failedCommand(
  id: string,
  failure: CommandFailure<EternityQuantity>,
): Command<EternityQuantity> {
  return { id, execute: (transaction) => transaction.reject(failure) };
}
