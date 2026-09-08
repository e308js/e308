import type {
  AutomationDefinition,
  BuyableDefinition,
  ChallengeDefinition,
  GameDefinition,
  GameKit,
  Resource,
  Scope,
  UpgradeDefinition,
} from "../../packages/core/src/index.js";
import { createGameKit, nativeNumbers } from "../../packages/core/src/index.js";
import { dimensionBoostCommand, type PurchaseHandles, purchaseCommand } from "./subject-actions.js";
import { adPurchaseCurve, createAdTick } from "./subject-production.js";
import type { AdState } from "./upstream.js";
import { AD_BASE_COSTS, AD_COST_MULTIPLIERS, dimensionBoostRequirement } from "./upstream.js";

export interface AdModel extends PurchaseHandles {
  readonly kit: GameKit<number>;
  readonly run: Scope;
  readonly permanent: Scope;
  readonly antimatter: Resource<number>;
  readonly galaxies: Resource<number>;
  readonly infinityPoints: Resource<number>;
  readonly infinities: Resource<number>;
  readonly totalTimePlayed: Resource<number>;
  readonly challenges: readonly ChallengeDefinition<number>[];
  readonly timeMult: UpgradeDefinition<number>;
  readonly dim18: UpgradeDefinition<number>;
  readonly dimensionAuto: AutomationDefinition<number>;
  readonly boostAuto: AutomationDefinition<number>;
  readonly definition: GameDefinition<number>;
}

interface Economy {
  readonly kit: GameKit<number>;
  readonly run: Scope;
  readonly permanent: Scope;
  readonly antimatter: Resource<number>;
  readonly boosts: Resource<number>;
  readonly galaxies: Resource<number>;
  readonly challengePower: Resource<number>;
  readonly infinityPoints: Resource<number>;
  readonly infinities: Resource<number>;
  readonly totalTimePlayed: Resource<number>;
  readonly dimensions: readonly Resource<number>[];
  readonly buyables: readonly BuyableDefinition<number>[];
}

export function createAdModel(initial: Partial<AdState>): AdModel {
  const economy = createEconomy();
  const challenges = createChallenges(economy);
  const [challenge2, , challenge10] = challenges as readonly [
    ChallengeDefinition<number>,
    ChallengeDefinition<number>,
    ChallengeDefinition<number>,
  ];
  const handles: PurchaseHandles = { ...economy, challenge2, challenge10 };
  const { timeMult, dim18 } = createUpgrades(economy);
  const { dimensionAuto, boostAuto } = createAutomation(economy, handles);
  const tick = economy.kit.steppedRule("ad-update", {
    ...createAdTick({ ...economy, scope: economy.run, challenges, initial }),
  });
  const definition = economy.kit.defineGame({
    id: "ad-reference-subject",
    simulationVersion: 1,
    stepMs: 100,
    resources: [
      economy.antimatter,
      ...economy.dimensions,
      economy.boosts,
      economy.galaxies,
      economy.challengePower,
      economy.infinityPoints,
      economy.infinities,
      economy.totalTimePlayed,
    ],
    buyables: economy.buyables,
    challenges,
    upgrades: [timeMult, dim18],
    automation: [dimensionAuto, boostAuto],
    steppedRules: [tick],
  });
  return {
    ...economy,
    ...handles,
    challenges,
    timeMult,
    dim18,
    dimensionAuto,
    boostAuto,
    definition,
  };
}

function createEconomy(): Economy {
  const kit = createGameKit({ numbers: nativeNumbers });
  const run = kit.scope("infinity-run");
  const permanent = kit.scope("infinity-upgrades");
  const antimatter = kit.resource("antimatter", { scope: run, initial: 10 });
  const boosts = kit.resource("dimension-boosts", { scope: run, initial: 0 });
  const galaxies = kit.resource("galaxies", { scope: run, initial: 0 });
  const challengePower = kit.resource("challenge-power", { scope: run, initial: 1 });
  const infinityPoints = kit.resource("infinity-points", { scope: permanent, initial: 0 });
  const infinities = kit.resource("infinities", { scope: permanent, initial: 0 });
  const totalTimePlayed = kit.resource("total-time-played-ms", { scope: permanent, initial: 0 });
  const dimensions = AD_BASE_COSTS.map((_, index) =>
    kit.resource(`dimension-${index + 1}`, { scope: run, initial: 0 }),
  );
  const buyables = dimensions.map((_, index) =>
    kit.buyable(`dimension-${index + 1}-purchases`, {
      scope: run,
      currency: antimatter,
      curve: adPurchaseCurve(AD_BASE_COSTS[index] as number, AD_COST_MULTIPLIERS[index] as number),
    }),
  );
  return {
    kit,
    run,
    permanent,
    antimatter,
    boosts,
    galaxies,
    challengePower,
    infinityPoints,
    infinities,
    totalTimePlayed,
    dimensions,
    buyables,
  };
}

function createChallenges(economy: Economy): readonly ChallengeDefinition<number>[] {
  return (["nc2", "nc3", "nc10"] as const).map((id) =>
    economy.kit.challenge(id, {
      scope: economy.permanent,
      maxCompletions: 1,
      enterReset: { clear: [economy.run] },
      exitReset: { clear: [economy.run] },
      canEnter: () => true,
      completionsEarned: (state) => (state.get(economy.antimatter) >= Number.MAX_VALUE ? 1 : 0),
    }),
  );
}

function createUpgrades(economy: Economy): {
  timeMult: UpgradeDefinition<number>;
  dim18: UpgradeDefinition<number>;
} {
  const timeMult = economy.kit.upgrade("time-mult", {
    scope: economy.permanent,
    costs: [[economy.infinityPoints, 1]],
    prerequisiteIds: [],
    unlocked: () => true,
  });
  const dim18 = economy.kit.upgrade("dim-18-mult", {
    scope: economy.permanent,
    costs: [[economy.infinityPoints, 1]],
    prerequisiteIds: ["time-mult"],
    unlocked: (state) => state.hasUpgrade("time-mult"),
  });
  return { timeMult, dim18 };
}

function createAutomation(
  economy: Economy,
  handles: PurchaseHandles,
): { dimensionAuto: AutomationDefinition<number>; boostAuto: AutomationDefinition<number> } {
  const dimensionAuto = economy.kit.automation("dimension-2-auto", {
    scope: economy.permanent,
    cadenceMs: 600,
    initiallyEnabled: false,
    unlocked: (state) => state.challengeCompletions(handles.challenge2.id) >= 1,
    condition: (state) => {
      const count = state.purchaseCount((economy.buyables[1] as BuyableDefinition<number>).id);
      const cost =
        (AD_BASE_COSTS[1] as number) * (AD_COST_MULTIPLIERS[1] as number) ** Math.floor(count / 10);
      return (
        state.get(economy.dimensions[0] as Resource<number>) > 0 &&
        state.get(economy.antimatter) >= cost
      );
    },
    action: () => purchaseCommand(2, true, handles),
  });
  const boostAuto = economy.kit.automation("dimension-boost-auto", {
    scope: economy.permanent,
    cadenceMs: 4000,
    initiallyEnabled: false,
    unlocked: (state) => state.challengeCompletions(handles.challenge10.id) >= 1,
    condition: (state) => {
      const requirement = dimensionBoostRequirement(state.get(economy.boosts));
      return (
        state.get(economy.dimensions[requirement.tier - 1] as Resource<number>) >=
        requirement.amount
      );
    },
    action: () =>
      dimensionBoostCommand(economy.dimensions, economy.boosts, economy.run, handles.challenge10),
  });
  return { dimensionAuto, boostAuto };
}
