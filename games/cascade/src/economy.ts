import {
  buyCommand,
  type Command,
  createGameKit,
  type EternityQuantity,
  eternityNumbers,
  geometricCurve,
} from "@e308/core";

export const cascadeKit = createGameKit({ numbers: eternityNumbers });
export const cascadeScopes = {
  run: cascadeKit.scope("run"),
  infinity: cascadeKit.scope("infinity"),
  eternity: cascadeKit.scope("eternity"),
} as const;

const q = cascadeKit.q;
export const cascadeResources = {
  currency: cascadeKit.resource("currency", { scope: cascadeScopes.run, initial: q(0) }),
  multiplier: cascadeKit.resource("multiplier", { scope: cascadeScopes.run, initial: q(1) }),
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
} as const;

export const cascadeTiers = Array.from({ length: 8 }, (_, index) =>
  cascadeKit.resource(`tier-${index + 1}`, {
    scope: cascadeScopes.run,
    initial: q(index === 7 ? 1 : 0),
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
    initialCount: q(index === 7 ? 1 : 0),
    refundRate: q(0),
  }),
);

export const buyTenMilestones = cascadeBuyables.map((buyable, index) =>
  cascadeKit.milestone(`dimension-${index + 1}-ten`, {
    scope: cascadeScopes.run,
    priority: index,
    when: (state) => eternityNumbers.cmp(state.purchaseCount(buyable.id), q(10)) >= 0,
    apply: (transaction) =>
      transaction.set(
        cascadeResources.multiplier,
        eternityNumbers.mul(transaction.get(cascadeResources.multiplier), q(2)),
      ),
  }),
);

export const cascadeProductionRule = cascadeKit.steppedRule("cascade-production", {
  scope: cascadeScopes.run,
  priority: 10,
  update(transaction, stepSeconds) {
    const start = cascadeTiers.map((tier) => transaction.get(tier));
    let multiplier = eternityNumbers.mul(
      transaction.get(cascadeResources.multiplier),
      q(stepSeconds),
    );
    multiplier = eternityNumbers.mul(
      multiplier,
      eternityNumbers.add(q(1), transaction.getAllocation("research", "speed")),
    );
    if (transaction.isChallengeActive("slow-foundation"))
      multiplier = eternityNumbers.div(multiplier, q(4));
    if (transaction.isChallengeActive("automation-drought"))
      multiplier = eternityNumbers.div(multiplier, q(2));
    transaction.add(
      cascadeResources.currency,
      eternityNumbers.mul(start[0] as EternityQuantity, multiplier),
    );
    transaction.addProduction(
      cascadeResources.currency.id,
      eternityNumbers.mul(start[0] as EternityQuantity, multiplier),
    );
    for (let index = 1; index < start.length; index += 1) {
      const output = eternityNumbers.mul(start[index] as EternityQuantity, multiplier);
      transaction.add(cascadeTiers[index - 1] as (typeof cascadeTiers)[number], output);
      transaction.addProduction(
        (cascadeTiers[index - 1] as (typeof cascadeTiers)[number]).id,
        output,
      );
    }
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
