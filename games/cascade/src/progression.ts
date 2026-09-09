import {
  allocationCommand,
  automationCommand,
  type ChallengeDefinition,
  type Command,
  type EternityQuantity,
  normalPrestige,
  prestigeCommand,
  staticPrestige,
  upgradeCommand,
} from "@e308/core";
import {
  buyDimensionCommand,
  cascadeBuyables,
  cascadeKit,
  cascadeResources,
  cascadeScopes,
} from "./economy.js";

const q = cascadeKit.q;
const numbers = cascadeKit.numbers;
const runReset = { clear: [cascadeScopes.run] } as const;

const challengeSpecs = [
  ["slow-foundation", 3, "pace", ["base-speed"]],
  ["reversed-emphasis", 1, "pace", ["tier-order"]],
  ["scarce-purchases", 1, "compatible", ["bulk-buy"]],
  ["reset-pressure", 1, "resets", ["reset-window"]],
  ["automation-drought", 1, "compatible", ["automation"]],
  ["composite-trial", 1, "composite", ["base-speed", "tier-order"]],
] as const;

export const cascadeChallenges: readonly ChallengeDefinition<EternityQuantity>[] =
  challengeSpecs.map(([id, maximum, group, replacementKeys]) =>
    cascadeKit.challenge(id, {
      scope: cascadeScopes.infinity,
      ...(group === "compatible" ? { compatibleGroup: "compatible" } : {}),
      countsAs: id === "composite-trial" ? ["slow-foundation", "reversed-emphasis"] : [],
      replacementKeys,
      maxCompletions: maximum,
      enterReset: runReset,
      exitReset: runReset,
      canEnter: (state) => numbers.cmp(state.get(cascadeResources.infinity), q(1)) >= 0,
      completionsEarned: (state) => challengeTier(id, state.get(cascadeResources.currency)),
      grantReward(transaction, tier) {
        transaction.add(cascadeResources.research, q(tier));
        if (id === "composite-trial") transaction.add(cascadeResources.singularity, q("1e320"));
      },
    }),
  );

const tierOneBuyable = cascadeBuyables[0];
if (!tierOneBuyable) throw new TypeError("Cascade requires a tier-one buyable");

const collapsePolicy = normalPrestige(numbers, {
  baseResource: cascadeResources.currency,
  requirement: q("1e6"),
  exponent: q(0.5),
});
export const collapse = cascadeKit.prestige("collapse", {
  scope: cascadeScopes.infinity,
  reward: cascadeResources.infinity,
  manifest: runReset,
  ...collapsePolicy,
});

const condensePolicy = staticPrestige(numbers, {
  baseResource: cascadeResources.infinity,
  rewardResource: cascadeResources.cores,
  requirement: q(5),
  exponent: q(1),
  base: q(2),
  canBuyMax: true,
});
export const condense = cascadeKit.prestige("condense", {
  scope: cascadeScopes.infinity,
  reward: cascadeResources.cores,
  manifest: runReset,
  prerequisiteIds: [collapse.id],
  ...condensePolicy,
});

const ascendPolicy = normalPrestige(numbers, {
  baseResource: cascadeResources.cores,
  requirement: q(3),
  exponent: q(1),
});
export const ascend = cascadeKit.prestige("ascend", {
  scope: cascadeScopes.eternity,
  reward: cascadeResources.eternity,
  manifest: {
    clear: [cascadeScopes.run, cascadeScopes.infinity],
    retain: { challenges: cascadeChallenges },
  },
  prerequisiteIds: [condense.id],
  ...ascendPolicy,
});

export const researchAllocation = cascadeKit.allocation("research", {
  scope: cascadeScopes.eternity,
  budget: cascadeResources.research,
  targets: ["speed", "retention"],
});

export const finalResearch = cascadeKit.upgrade("final-research", {
  scope: cascadeScopes.eternity,
  costs: [[cascadeResources.eternity, q(1)]],
  prerequisiteIds: cascadeChallenges.map((challenge) => challenge.id),
  unlocked: (state) =>
    cascadeChallenges.every(
      (challenge) => numbers.cmp(state.challengeCompletions(challenge.id), q(1)) >= 0,
    ) &&
    numbers.cmp(state.get(cascadeResources.singularity), q("1e308")) > 0 &&
    numbers.cmp(state.get(cascadeResources.respecs), q(1)) >= 0,
});

export const dimensionAutomation = cascadeKit.automation("buy-tier-one", {
  scope: cascadeScopes.infinity,
  priority: 10,
  cadenceMs: 5_000,
  initiallyEnabled: false,
  unlocked: (state) => numbers.cmp(state.get(cascadeResources.infinity), q(1)) >= 0,
  condition: (state) =>
    numbers.cmp(
      state.get(cascadeResources.currency),
      tierOneBuyable.curve.unitCost(state.purchaseCount(tierOneBuyable.id)),
    ) >= 0,
  action: () => buyDimensionCommand(0),
});

export const collapseAutomation = cascadeKit.automation("auto-collapse", {
  scope: cascadeScopes.infinity,
  priority: 20,
  cadenceMs: 30_000,
  initiallyEnabled: false,
  unlocked: (state) => numbers.cmp(state.get(cascadeResources.infinity), q(2)) >= 0,
  condition: collapse.canReset,
  action: () => prestigeCommand(collapse),
});

export function allocateResearchCommand(
  target: "speed" | "retention",
  amount: EternityQuantity,
): Command<EternityQuantity> {
  return allocationCommand(researchAllocation, target, amount);
}

export function respecResearchCommand(): Command<EternityQuantity> {
  return {
    id: "research:respec",
    execute(transaction) {
      transaction.setAllocation(researchAllocation.id, "speed", q(0));
      transaction.setAllocation(researchAllocation.id, "retention", q(0));
      transaction.add(cascadeResources.respecs, q(1));
    },
  };
}

export const cascadePrestiges = [collapse, condense, ascend] as const;
export const cascadeAutomation = [dimensionAutomation, collapseAutomation] as const;
export const cascadeUpgrades = [finalResearch] as const;

export function progressionCommand(
  intent:
    | { readonly type: "prestige"; readonly id: "collapse" | "condense" | "ascend" }
    | {
        readonly type: "automation";
        readonly id: "dimension" | "collapse";
        readonly enabled: boolean;
      }
    | {
        readonly type: "research";
        readonly target: "speed" | "retention";
        readonly amount: EternityQuantity;
      }
    | { readonly type: "respec" }
    | { readonly type: "final-research" },
): Command<EternityQuantity> {
  if (intent.type === "prestige") return prestigeCommand({ collapse, condense, ascend }[intent.id]);
  if (intent.type === "automation")
    return automationCommand(
      intent.id === "dimension" ? dimensionAutomation : collapseAutomation,
      intent.enabled,
    );
  if (intent.type === "research") return allocateResearchCommand(intent.target, intent.amount);
  if (intent.type === "respec") return respecResearchCommand();
  return upgradeCommand(finalResearch);
}

function challengeTier(id: string, currency: EternityQuantity): number {
  if (id !== "slow-foundation") return numbers.cmp(currency, q("1e7")) >= 0 ? 1 : 0;
  if (numbers.cmp(currency, q("1e12")) >= 0) return 3;
  if (numbers.cmp(currency, q("1e9")) >= 0) return 2;
  return numbers.cmp(currency, q("1e7")) >= 0 ? 1 : 0;
}
