import {
  type BuyableDefinition,
  createGameKit,
  type EternityQuantity,
  type Resource,
  type Scope,
  type TriggerDefinition,
  type UpgradeDefinition,
} from "../../packages/core/src/index.js";
import {
  A_UPGRADE_COST_BASES,
  A_UPGRADE_COST_RATIOS,
  B_UPGRADE_SPECS,
  GENERATOR_COST_BASES,
  GENERATOR_COST_RATIOS,
} from "./constants.js";
import { arrayGeometricCurve, arrayNumbers, q } from "./math.js";

export const arrayKit = createGameKit({ numbers: arrayNumbers });
export const arrayScopes = {
  a: arrayKit.scope("array-a"),
  b: arrayKit.scope("array-b"),
  permanent: arrayKit.scope("array-permanent"),
} as const;

export const arrayResources = {
  A: arrayKit.resource("array-a", { scope: arrayScopes.a, initial: q("10") }),
  B: arrayKit.resource("array-b", { scope: arrayScopes.b, initial: q("0") }),
  boosters: arrayKit.resource("a-boosters", { scope: arrayScopes.b, initial: q("0") }),
} as const;

export const arrayMilestones: readonly TriggerDefinition<EternityQuantity>[] = [
  arrayKit.milestone("array-b-unlocked", {
    scope: arrayScopes.b,
    when: (state) => arrayNumbers.cmp(state.get(arrayResources.B), q("1")) >= 0,
  }),
];

export interface GeneratorFamily {
  readonly id: "A" | "B";
  readonly scope: Scope;
  readonly currency: Resource<EternityQuantity>;
  readonly amounts: readonly Resource<EternityQuantity>[];
  readonly buyables: readonly BuyableDefinition<EternityQuantity>[];
}

function generatorFamily(id: "A" | "B", scope: Scope): GeneratorFamily {
  const currency = arrayResources[id];
  const amounts = GENERATOR_COST_BASES[id].map((_, index) =>
    arrayKit.resource(`${id.toLowerCase()}-generator-${index + 1}`, { scope, initial: q("0") }),
  );
  const buyables = amounts.map((_, index) =>
    arrayKit.buyable(`${id.toLowerCase()}-generator-${index + 1}-bought`, {
      scope,
      currency,
      curve: arrayGeometricCurve(
        q(String(GENERATOR_COST_BASES[id][index])),
        q(String(GENERATOR_COST_RATIOS[index])),
      ),
      refundRate: q("0"),
    }),
  );
  return Object.freeze({ id, scope, currency, amounts, buyables });
}

export const arrayGenerators = {
  A: generatorFamily("A", arrayScopes.a),
  B: generatorFamily("B", arrayScopes.b),
} as const;

export const aUpgradeBuyables = A_UPGRADE_COST_BASES.map((base, index) =>
  arrayKit.buyable(`a-upgrade-${index + 1}-bought`, {
    scope: arrayScopes.a,
    currency: arrayResources.A,
    curve: arrayGeometricCurve(q(String(base)), q(String(A_UPGRADE_COST_RATIOS[index]))),
    refundRate: q("0"),
  }),
);

export const boosterator = arrayKit.buyable("a-boosterators", {
  scope: arrayScopes.b,
  currency: arrayResources.B,
  curve: arrayGeometricCurve(q("3"), q("2")),
  refundRate: q("0"),
});

export const bUpgrades: readonly UpgradeDefinition<EternityQuantity>[] = B_UPGRADE_SPECS.map(
  (spec) =>
    arrayKit.upgrade(spec.id, {
      scope: arrayScopes.b,
      costs: spec.cost === 0 ? [] : [[arrayResources.B, q(String(spec.cost))]],
      prerequisiteIds: ["array-b-unlocked"],
      unlocked: (state) =>
        state.hasMilestone("array-b-unlocked") &&
        (!("requires" in spec) ||
          arrayNumbers.cmp(state.get(arrayResources.B), q(String(spec.requires))) >= 0),
    }),
);
