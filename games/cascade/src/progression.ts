import {
  allocationCommand,
  automationCommand,
  type ChallengeDefinition,
  type Command,
  type EternityQuantity,
  normalPrestige,
  prestigeCommand,
  staticPrestige,
  type Transaction,
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
const cascadeMath = (() => {
  const math = numbers.transcendental;
  if (!math) throw new TypeError("Cascade requires exponential number operations");
  return math;
})();
const runReset = { clear: [cascadeScopes.run] } as const;

export const cascadeBalance = {
  collapseRequirement: q("1e6"),
  collapseExponent: q(0.25),
  collapseSoftcap: { threshold: q(16), power: q(0.1) },
  firstCoreRequirement: q(100),
  coreCostBase: q(4),
  ascendRequirement: q(3),
  coreProductionBase: q(4),
  eternityProductionBase: q(10),
} as const;

export function nextCoreCost(cores: EternityQuantity): EternityQuantity {
  return numbers.mul(
    cascadeBalance.firstCoreRequirement,
    cascadeMath.pow(cascadeBalance.coreCostBase, cores),
  );
}

const challengeSpecs = [
  ["slow-foundation", 3, "pace", ["base-speed"]],
  ["reversed-emphasis", 1, "pace", ["tier-order"]],
  ["scarce-purchases", 1, "compatible", ["bulk-buy"]],
  ["reset-pressure", 1, "resets", ["reset-window"]],
  ["automation-drought", 1, "compatible", ["automation"]],
  ["composite-trial", 1, "composite", ["base-speed", "tier-order"]],
] as const;

export const cascadeChallengeTargets = {
  "slow-foundation": [q("1e9"), q("1e10"), q("1e11")],
  "reversed-emphasis": [q("1e12")],
  "scarce-purchases": [q("1e12")],
  "reset-pressure": [q("1e13")],
  "automation-drought": [q("1e13")],
  "composite-trial": [q("1e14")],
} as const;

export const cascadeChallengeCopy: Readonly<
  Record<string, { readonly rule: string; readonly target: string; readonly reward: string }>
> = {
  "slow-foundation": {
    rule: "The full producer chain runs at 25% output.",
    target: "Reach 1e11 currency. Milestones at 1e9, 1e10, and 1e11 grant three points.",
    reward: "Up to 3 research points",
  },
  "reversed-emphasis": {
    rule: "Each higher generator tier receives a steeper production penalty.",
    target: "Reach 1e12 currency.",
    reward: "1 research point",
  },
  "scarce-purchases": {
    rule: "Group purchases are disabled; generators must be bought one at a time.",
    target: "Reach 1e12 currency.",
    reward: "1 research point",
  },
  "reset-pressure": {
    rule: "The full producer chain runs at 50% output and the target is increased.",
    target: "Reach 1e13 currency.",
    reward: "1 research point",
  },
  "automation-drought": {
    rule: "The full producer chain runs at 50% output while dimension automation is unavailable.",
    target: "Reach 1e13 currency.",
    reward: "1 research point",
  },
  "composite-trial": {
    rule: "Slow Foundation and Reversed Emphasis apply together.",
    target: "Reach 1e14 currency.",
    reward: "1 research point and a singularity",
  },
};

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
      completionsEarned: (state) =>
        cascadeChallengeTier(
          id,
          state.get(cascadeResources.currency),
          cascadeBuyables.every(
            (buyable) => numbers.cmp(state.purchaseCount(buyable.id), q(10)) >= 0,
          ),
        ),
      grantReward(transaction) {
        transaction.add(cascadeResources.research, q(1));
        if (id === "composite-trial") transaction.add(cascadeResources.singularity, q("1e320"));
      },
    }),
  );

const tierOneBuyable = cascadeBuyables[0];
if (!tierOneBuyable) throw new TypeError("Cascade requires a tier-one buyable");

const baseCollapsePolicy = normalPrestige(numbers, {
  baseResource: cascadeResources.currency,
  requirement: cascadeBalance.collapseRequirement,
  exponent: cascadeBalance.collapseExponent,
  softcap: cascadeBalance.collapseSoftcap,
});
export const collapse = cascadeKit.prestige("collapse", {
  scope: cascadeScopes.infinity,
  reward: cascadeResources.infinity,
  manifest: runReset,
  canReset: (state) =>
    baseCollapsePolicy.canReset(state) &&
    cascadeBuyables.every((buyable) => numbers.cmp(state.purchaseCount(buyable.id), q(10)) >= 0),
  rewardFor: (state) =>
    numbers.mul(
      baseCollapsePolicy.rewardFor(state),
      numbers.add(q(1), state.getAllocation(researchAllocation, "retention")),
    ),
});

const condensePolicy = staticPrestige(numbers, {
  baseResource: cascadeResources.infinity,
  rewardResource: cascadeResources.cores,
  requirement: cascadeBalance.firstCoreRequirement,
  exponent: q(1),
  base: cascadeBalance.coreCostBase,
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
  requirement: cascadeBalance.ascendRequirement,
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
    numbers.cmp(state.get(cascadeResources.eternity), q(1)) >= 0 &&
    numbers.cmp(state.getAllocation(researchAllocation, "speed"), q(1)) >= 0 &&
    numbers.cmp(state.getAllocation(researchAllocation, "retention"), q(1)) >= 0,
});

export const dimensionAutomation = cascadeKit.automation("buy-tier-one", {
  scope: cascadeScopes.infinity,
  priority: 10,
  cadenceMs: 5_000,
  initiallyEnabled: false,
  unlocked: (state) =>
    numbers.cmp(state.get(cascadeResources.infinity), q(1)) >= 0 &&
    !state.isChallengeActive("automation-drought"),
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
  action: () => cascadePrestigeCommand("collapse"),
});

export function allocateResearchCommand(
  target: "speed" | "retention",
  amount: EternityQuantity,
): Command<EternityQuantity> {
  const base = allocationCommand(researchAllocation, target, amount);
  return {
    id: base.id,
    execute(transaction) {
      base.execute(transaction);
      refreshCascadeMultiplier(transaction);
    },
  };
}

export function respecResearchCommand(): Command<EternityQuantity> {
  return {
    id: "research:respec",
    execute(transaction) {
      transaction.setAllocation(researchAllocation.id, "speed", q(0));
      transaction.setAllocation(researchAllocation.id, "retention", q(0));
      transaction.add(cascadeResources.respecs, q(1));
      refreshCascadeMultiplier(transaction);
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
  if (intent.type === "prestige") return cascadePrestigeCommand(intent.id);
  if (intent.type === "automation")
    return automationCommand(
      intent.id === "dimension" ? dimensionAutomation : collapseAutomation,
      intent.enabled,
    );
  if (intent.type === "research") return allocateResearchCommand(intent.target, intent.amount);
  if (intent.type === "respec") return respecResearchCommand();
  return upgradeCommand(finalResearch);
}

function cascadePrestigeCommand(id: "collapse" | "condense" | "ascend"): Command<EternityQuantity> {
  const base = prestigeCommand({ collapse, condense, ascend }[id]);
  return {
    id: base.id,
    execute(transaction) {
      if (
        id === "ascend" &&
        cascadeChallenges.some(
          (challenge) => numbers.cmp(transaction.getChallengeCompletions(challenge.id), q(1)) < 0,
        )
      )
        transaction.reject({
          code: "locked",
          prerequisiteIds: ["all six challenge rewards"],
        });
      base.execute(transaction);
      refreshCascadeMultiplier(transaction);
    },
  };
}

function refreshCascadeMultiplier(transaction: Transaction<EternityQuantity>): void {
  const research = numbers.add(q(1), transaction.getAllocation(researchAllocation.id, "speed"));
  const infinity = numbers.add(q(1), transaction.get(cascadeResources.infinity));
  const cores = cascadeMath.pow(
    cascadeBalance.coreProductionBase,
    transaction.get(cascadeResources.cores),
  );
  const eternity = cascadeMath.pow(
    cascadeBalance.eternityProductionBase,
    transaction.get(cascadeResources.eternity),
  );
  transaction.set(
    cascadeResources.prestigeMultiplier,
    numbers.mul(numbers.mul(numbers.mul(research, infinity), cores), eternity),
  );
}

export function cascadeChallengeTier(
  id: string,
  currency: EternityQuantity,
  routeComplete = true,
): number {
  if (!routeComplete) return 0;
  const targets = cascadeChallengeTargets[id as keyof typeof cascadeChallengeTargets];
  if (!targets) return 0;
  return targets.filter((target) => numbers.cmp(currency, target) >= 0).length;
}
