import type { CatchupExecution, EternityQuantity, Game } from "@e308/core";
import {
  advanceOptimized,
  type BulkCapability,
  producerChainBulkCapability,
} from "@e308/core/optimize";
import { cascadeDefinition } from "./definition.js";
import {
  cascadeBuyables,
  cascadeKit,
  cascadeResources,
  cascadeStepMs,
  cascadeTierCoefficient,
  cascadeTiers,
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
    const active = new Set(snapshot.progression.activeChallenges);
    return numbers.mul(
      cascadeTierCoefficient({
        sharedMultiplier: snapshot.resources[
          cascadeResources.prestigeMultiplier.id
        ] as EternityQuantity,
        purchaseCount: snapshot.purchaseCounts[buyable.id] as EternityQuantity,
        index,
        challenged: active.size > 0,
        isChallengeActive: (id) => active.has(id),
      }),
      q(cascadeStepMs / 1_000),
    );
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

export function advanceCascadeOptimized(
  game: Game<EternityQuantity>,
  durationMs: number,
  maximumWork: number,
) {
  return advanceOptimized(game, cascadeDefinition, durationMs, {
    mode: "exact",
    capabilities: [cascadeBulkCapability],
    limits: { maximumWork, maximumBulkBatches: maximumWork },
  });
}

export const cascadeCatchupExecution: CatchupExecution<EternityQuantity> = {
  kind: "optimized",
  advance: (game, pendingRealMs, maximumWork) => {
    const durationMs = Math.min(pendingRealMs, maximumWork * cascadeStepMs);
    const report = advanceCascadeOptimized(game, durationMs, maximumWork);
    return {
      ...report,
      status:
        report.status === "completed" && durationMs < pendingRealMs ? "pending" : report.status,
    };
  },
};
