import {
  type BuyableDefinition,
  buyCommand,
  type ChallengeDefinition,
  type Command,
  type Resource,
  type Scope,
} from "../../packages/core/src/index.js";
import { dimensionBoostRequirement, galaxyRequirement } from "./upstream.js";

export interface PurchaseHandles {
  readonly dimensions: readonly Resource<number>[];
  readonly buyables: readonly BuyableDefinition<number>[];
  readonly boosts: Resource<number>;
  readonly challenge2: ChallengeDefinition<number>;
  readonly challenge10: ChallengeDefinition<number>;
  readonly challengePower: Resource<number>;
}

export function purchaseCommand(
  tier: number,
  untilTen: boolean,
  handles: PurchaseHandles,
): Command<number> {
  const dimension = handles.dimensions[tier - 1];
  const buyable = handles.buyables[tier - 1];
  if (!dimension || !buyable) return invalidTier(tier);
  return {
    id: `ad-buy-${tier}`,
    execute: (tx) => {
      assertAvailable(tx, tier, handles);
      const count = untilTen ? 10 - (tx.getPurchase(buyable.id) % 10) : 1;
      buyCommand(buyable, { mode: "exact", count }).execute(tx);
      tx.add(dimension, count);
      if (tx.isChallengeActive(handles.challenge2.id)) tx.set(handles.challengePower, 0);
    },
  };
}

export function maxPurchaseCommand(tier: number, handles: PurchaseHandles): Command<number> {
  const dimension = handles.dimensions[tier - 1];
  const buyable = handles.buyables[tier - 1];
  if (!dimension || !buyable) return invalidTier(tier);
  return {
    id: `ad-max-${tier}`,
    execute: (tx) => {
      assertAvailable(tx, tier, handles);
      const before = tx.getPurchase(buyable.id);
      while (true) {
        const count = 10 - (tx.getPurchase(buyable.id) % 10);
        const cost = buyable.curve.totalCost(tx.getPurchase(buyable.id), count);
        if (tx.get(buyable.currency) < cost) break;
        buyCommand(buyable, { mode: "exact", count }).execute(tx);
      }
      tx.add(dimension, tx.getPurchase(buyable.id) - before);
    },
  };
}

export function dimensionBoostCommand(
  dimensions: readonly Resource<number>[],
  boosts: Resource<number>,
  run: Scope,
  challenge10: ChallengeDefinition<number>,
): Command<number> {
  return {
    id: "dimension-boost",
    execute: (tx) => {
      const requirement = dimensionBoostRequirement(
        tx.get(boosts),
        tx.isChallengeActive(challenge10.id),
      );
      const source = dimensions[requirement.tier - 1] as Resource<number>;
      if (tx.get(source) < requirement.amount)
        tx.reject({
          code: "locked",
          prerequisiteIds: [`dimension-${requirement.tier}:${requirement.amount}`],
        });
      const next = tx.get(boosts) + 1;
      tx.reset({ clear: [run] });
      tx.set(boosts, next);
    },
  };
}

export function galaxyCommand(
  dimensions: readonly Resource<number>[],
  antimatter: Resource<number>,
  boosts: Resource<number>,
  galaxies: Resource<number>,
  run: Scope,
): Command<number> {
  return {
    id: "galaxy",
    execute: (tx) => {
      const requirement = galaxyRequirement(tx.get(galaxies));
      if (tx.get(dimensions[7] as Resource<number>) < requirement.amount)
        tx.reject({ code: "locked", prerequisiteIds: [`dimension-8:${requirement.amount}`] });
      const next = tx.get(galaxies) + 1;
      tx.reset({ clear: [run] });
      tx.set(galaxies, next);
      tx.set(boosts, 0);
      tx.set(antimatter, 10);
    },
  };
}

export function infinityCommand(
  antimatter: Resource<number>,
  infinityPoints: Resource<number>,
  infinities: Resource<number>,
  run: Scope,
): Command<number> {
  return {
    id: "infinity",
    execute: (tx) => {
      if (tx.get(antimatter) < Number.MAX_VALUE)
        tx.reject({
          code: "locked",
          prerequisiteIds: ["antimatter:1.7976931348623157e308"],
        });
      tx.reset({ clear: [run] });
      tx.add(infinityPoints, 1);
      tx.add(infinities, 1);
    },
  };
}

function assertAvailable(
  tx: Parameters<Command<number>["execute"]>[0],
  tier: number,
  handles: PurchaseHandles,
): void {
  if (
    tier > tx.get(handles.boosts) + 4 ||
    (tier > 1 && tx.get(handles.dimensions[tier - 2] as Resource<number>) <= 0) ||
    (tx.isChallengeActive(handles.challenge10.id) && tier > 6)
  ) {
    tx.reject({ code: "locked", prerequisiteIds: [`dimension-${tier - 1}`] });
  }
}

function invalidTier(tier: number): Command<number> {
  return {
    id: "invalid-dimension",
    execute: (tx) => tx.reject({ code: "invalid-target", id: String(tier) }),
  };
}
