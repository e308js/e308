import {
  advanceProducerChain,
  buyCommand,
  type Command,
  createGameKit,
  type EternityQuantity,
  eternityNumbers,
  geometricCurve,
} from "@e308/core";

export const cascadeKit = createGameKit({ numbers: eternityNumbers });
export const cascadeStepMs = 250;
export const cascadeScopes = {
  run: cascadeKit.scope("run"),
  infinity: cascadeKit.scope("infinity"),
  eternity: cascadeKit.scope("eternity"),
} as const;

const q = cascadeKit.q;
const cascadeMath = (() => {
  const math = eternityNumbers.transcendental;
  if (!math) throw new TypeError("Cascade requires exponential number operations");
  return math;
})();
const tierMultiplierCache = new WeakMap<object, EternityQuantity>();
export const cascadeResources = {
  currency: cascadeKit.resource("currency", { scope: cascadeScopes.run, initial: q(10) }),
  infinity: cascadeKit.resource("infinity-points", {
    scope: cascadeScopes.infinity,
    initial: q(0),
  }),
  cores: cascadeKit.resource("condensed-cores", {
    scope: cascadeScopes.infinity,
    initial: q(0),
  }),
  eternity: cascadeKit.resource("eternity-points", {
    scope: cascadeScopes.eternity,
    initial: q(0),
  }),
  research: cascadeKit.resource("research-points", {
    scope: cascadeScopes.eternity,
    initial: q(0),
  }),
  singularity: cascadeKit.resource("singularity", {
    scope: cascadeScopes.eternity,
    initial: q(0),
  }),
  respecs: cascadeKit.resource("respecs", { scope: cascadeScopes.eternity, initial: q(0) }),
  prestigeMultiplier: cascadeKit.resource("prestige-multiplier", {
    scope: cascadeScopes.eternity,
    initial: q(1),
  }),
} as const;

export const cascadeTiers = Array.from({ length: 8 }, (_, index) =>
  cascadeKit.resource(`tier-${index + 1}`, {
    scope: cascadeScopes.run,
    initial: q(0),
  }),
);

export const cascadeBuyables = cascadeTiers.map((_, index) =>
  cascadeKit.buyable(`dimension-${index + 1}`, {
    scope: cascadeScopes.run,
    currency: cascadeResources.currency,
    curve: geometricCurve(eternityNumbers, {
      base: q(`1e${index + 1}`),
      ratio: q(2),
    }),
    initialCount: q(0),
    refundRate: q(0),
  }),
);

export const buyTenMilestones = cascadeBuyables.map((buyable, index) =>
  cascadeKit.milestone(`dimension-${index + 1}-ten`, {
    scope: cascadeScopes.run,
    priority: index,
    when: (state) => eternityNumbers.cmp(state.purchaseCount(buyable.id), q(10)) >= 0,
    apply: () => undefined,
  }),
);

export function purchasedTierMultiplier(count: EternityQuantity): EternityQuantity {
  const cached = tierMultiplierCache.get(count);
  if (cached) return cached;
  const groups = eternityNumbers.floor(eternityNumbers.div(count, q(10)));
  const multiplier = cascadeMath.pow(q(2), groups);
  tierMultiplierCache.set(count, multiplier);
  return multiplier;
}

export function cascadeSharedMultiplier(
  multiplier: EternityQuantity,
  challenged: boolean,
): EternityQuantity {
  return challenged ? cascadeMath.pow(multiplier, q(1 / cascadeTiers.length)) : multiplier;
}

export function cascadeTierCoefficient(options: {
  readonly sharedMultiplier: EternityQuantity;
  readonly purchaseCount: EternityQuantity;
  readonly index: number;
  readonly challenged: boolean;
  readonly isChallengeActive: (id: string) => boolean;
}): EternityQuantity {
  const { index, isChallengeActive } = options;
  let value = eternityNumbers.mul(
    cascadeSharedMultiplier(options.sharedMultiplier, options.challenged),
    purchasedTierMultiplier(options.purchaseCount),
  );
  if (isChallengeActive("slow-foundation") || isChallengeActive("composite-trial"))
    value = eternityNumbers.div(value, cascadeMath.pow(q(4), q(1 / cascadeTiers.length)));
  if (isChallengeActive("automation-drought") || isChallengeActive("reset-pressure"))
    value = eternityNumbers.div(value, cascadeMath.pow(q(2), q(1 / cascadeTiers.length)));
  if (isChallengeActive("reversed-emphasis") || isChallengeActive("composite-trial"))
    value = eternityNumbers.div(value, cascadeMath.pow(q(2), q(index / cascadeTiers.length)));
  return value;
}

export const cascadeProductionRule = cascadeKit.steppedRule("cascade-production", {
  scope: cascadeScopes.run,
  priority: 10,
  update(transaction, stepSeconds) {
    advanceProducerChain(transaction, {
      output: cascadeResources.currency,
      tiers: cascadeTiers,
      seconds: stepSeconds,
      rate: ({ index, amount }) => {
        return eternityNumbers.mul(
          amount,
          cascadeTierCoefficient({
            sharedMultiplier: transaction.get(cascadeResources.prestigeMultiplier),
            purchaseCount: transaction.getPurchase(cascadeBuyables[index]?.id ?? ""),
            index,
            challenged: transaction.hasActiveChallenges(),
            isChallengeActive: (id) => transaction.isChallengeActive(id),
          }),
        );
      },
    });
  },
});

export function buyDimensionCommand(index: number, count = 1): Command<EternityQuantity> {
  const buyable = cascadeBuyables[index];
  const tier = cascadeTiers[index];
  if (!buyable || !tier) {
    return {
      id: `buy-dimension:${index + 1}`,
      execute: (transaction) =>
        transaction.reject({ code: "invalid-target", id: `dimension-${index + 1}` }),
    };
  }
  const quantity = q(count);
  return {
    id: `buy-dimension:${index + 1}:${count}`,
    execute(transaction) {
      if (transaction.isChallengeActive("scarce-purchases") && count > 1)
        transaction.reject({ code: "disabled", actionId: buyable.id, reasonKey: "single-only" });
      buyCommand(buyable, { mode: "exact", count: quantity }).execute(transaction);
      transaction.add(tier, quantity);
    },
  };
}

export function encoded(value: EternityQuantity): string {
  return eternityNumbers.codec.serialize(value);
}
