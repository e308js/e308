import type { EternityQuantity } from "@e308/core";
import { type BulkCapability, producerChainBulkCapability } from "@e308/core/optimize";
import {
  cascadeBuyables,
  cascadeKit,
  cascadeResources,
  cascadeTiers,
  purchasedTierMultiplier,
} from "./economy.js";

const numbers = cascadeKit.numbers;
const q = cascadeKit.q;

export const cascadeBulkCapability: BulkCapability<EternityQuantity> = producerChainBulkCapability({
  id: "cascade/producer-chain",
  version: "1",
  output: cascadeResources.currency,
  tiers: cascadeTiers,
  dependencies: ["cascade-production", "dimension-purchases", "challenges", "automation-clock"],
  coefficient: ({ snapshot, index }) => {
    const buyable = cascadeBuyables[index] as (typeof cascadeBuyables)[number];
    let value = numbers.mul(
      snapshot.resources[cascadeResources.prestigeMultiplier.id] as EternityQuantity,
      purchasedTierMultiplier(snapshot.purchaseCounts[buyable.id] as EternityQuantity),
    );
    const active = new Set(snapshot.progression.activeChallenges);
    if (active.has("slow-foundation") || active.has("composite-trial"))
      value = numbers.div(value, q(4));
    if (active.has("automation-drought") || active.has("reset-pressure"))
      value = numbers.div(value, q(2));
    if (active.has("reversed-emphasis") || active.has("composite-trial"))
      value = numbers.div(value, q(2 ** index));
    return value;
  },
  ineligibleReason: (snapshot) =>
    cascadeBuyables.every((buyable) => {
      const earned =
        numbers.cmp(snapshot.purchaseCounts[buyable.id] as EternityQuantity, q(10)) >= 0;
      return earned === Boolean(snapshot.progression.milestones[`${buyable.id}-ten`]);
    })
      ? undefined
      : "pending-progression-trigger",
});
