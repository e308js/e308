import {
  allocationCommand,
  buyCommand,
  type Command,
  type CommandFailure,
  createGame,
  createSaveCodec,
  type Game,
  marketCommand,
  nativeNumbers,
  quoteMarket,
  recipeCommand,
  type Snapshot,
  upgradeCommand,
} from "@e308/core";
import { GameViewSource } from "@e308/ux";
import {
  supplyBatch,
  wireworksAllocation,
  wireworksBuyables,
  wireworksDefinition,
  wireworksMarkets,
  wireworksProjects,
  wireworksResources,
} from "./content.js";

export type WireworksBand = keyof typeof wireworksMarkets;
export type WireworksMachine = keyof typeof wireworksBuyables;
export type WireworksIntent =
  | { readonly type: "advance"; readonly milliseconds: number }
  | { readonly type: "make" }
  | { readonly type: "supply" }
  | { readonly type: "buy-machine"; readonly machine: WireworksMachine; readonly count: number }
  | { readonly type: "sell"; readonly band: WireworksBand; readonly quantity: number }
  | { readonly type: "project"; readonly id: string }
  | {
      readonly type: "allocate";
      readonly target: "extrusion" | "assembly";
      readonly amount: number;
    };

export type WireworksResult =
  | ReturnType<Game<number>["dispatch"]>
  | ReturnType<Game<number>["advance"]>;

const saveConfiguration = {
  stateSchemaVersion: 2,
  contentVersion: "1.1.0",
  contentDigest: "wireworks-1.1.0-production-network-2026-09-09",
} as const;

export const wireworksSaveCodec = createSaveCodec(wireworksDefinition, saveConfiguration);

export function createWireworks(snapshot?: Snapshot<number>): WireworksGame {
  return new WireworksGame(createGame(wireworksDefinition, snapshot ? { snapshot } : {}));
}

export class WireworksGame extends GameViewSource<number, WireworksIntent, WireworksResult> {
  constructor(game: Game<number>) {
    super(game, (target, intent) => {
      if (intent.type === "advance") return target.advance(intent.milliseconds);
      return target.dispatch(wireworksCommand(target.getSnapshot(), intent));
    });
  }

  exportSave(wallAnchorMs: number): string {
    return wireworksSaveCodec.encode(this.game.getSnapshot(), {
      wallAnchorMs,
      entitlement: {
        policyVersion: "wireworks-offline-1",
        enabled: true,
        capMs: 8 * 60 * 60_000,
        excess: "bank",
      },
      catchup: null,
    });
  }
}

export function importWireworks(raw: string): WireworksGame {
  return createWireworks(wireworksSaveCodec.decode(raw).snapshot);
}

export function wireworksCommand(
  snapshot: Snapshot<number>,
  intent: Exclude<WireworksIntent, { readonly type: "advance" }>,
): Command<number> {
  if (intent.type === "make") return makeClipCommand();
  if (intent.type === "supply") return recipeCommand(supplyBatch, { count: 1 });
  if (intent.type === "buy-machine")
    return buyCommand(wireworksBuyables[intent.machine], {
      mode: "exact",
      count: intent.count,
    });
  if (intent.type === "project") return projectCommand(intent.id);
  if (intent.type === "allocate")
    return allocationCommand(wireworksAllocation, intent.target, intent.amount);
  return saleCommand(snapshot, intent.band, intent.quantity);
}

function makeClipCommand(): Command<number> {
  return {
    id: "make-clip",
    execute(transaction) {
      const wire = transaction.get(wireworksResources.wire);
      const clips = transaction.get(wireworksResources.clips);
      const capacity = 500 + transaction.get(wireworksResources.storage) * 500;
      if (wire < 1)
        transaction.reject({
          code: "insufficient",
          resourceId: wireworksResources.wire.id,
          required: 1,
          available: wire,
        });
      if (clips >= capacity)
        transaction.reject({
          code: "capacity-blocked",
          resourceId: wireworksResources.clips.id,
          attempted: clips + 1,
          capacity,
        });
      transaction.add(wireworksResources.wire, -1);
      transaction.add(wireworksResources.clips, 1);
      transaction.addProduction(wireworksResources.clips.id, 1);
    },
  };
}

function projectCommand(id: string): Command<number> {
  const project = wireworksProjects.find((candidate) => candidate.id === id);
  if (!project) return invalidCommand(`project:${id}`, id);
  return upgradeCommand(project);
}

function saleCommand(
  snapshot: Snapshot<number>,
  band: WireworksBand,
  quantity: number,
): Command<number> {
  const market = wireworksMarkets[band];
  const quote = quoteMarket(market, snapshot, "sell", quantity, nativeNumbers);
  if (!quote.ok) return failureCommand(`sell:${band}`, quote.error);
  const demandCost = band === "volume" ? 5 : band === "standard" ? 10 : 20;
  const reachGain = band === "volume" ? 1 : band === "standard" ? 0.25 : 0;
  return {
    id: `sell:${band}`,
    expectedRevision: snapshot.revision,
    execute(transaction) {
      const available = transaction.get(wireworksResources.demand);
      if (available < demandCost) {
        transaction.reject({
          code: "insufficient",
          resourceId: wireworksResources.demand.id,
          required: demandCost,
          available,
        });
      }
      marketCommand(market, quote.value).execute(transaction);
      transaction.add(wireworksResources.demand, -demandCost);
      transaction.set(
        wireworksResources.reach,
        Math.min(100, transaction.get(wireworksResources.reach) + reachGain),
      );
    },
  };
}

function invalidCommand(id: string, target: string): Command<number> {
  return {
    id,
    execute: (transaction) => transaction.reject({ code: "invalid-target", id: target }),
  };
}

function failureCommand(id: string, failure: CommandFailure<number>): Command<number> {
  return { id, execute: (transaction) => transaction.reject(failure) };
}
