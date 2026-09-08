import type {
  BuyableDefinition,
  ChallengeDefinition,
  Command,
  PurchaseCurve,
  Resource,
  SteppedRuleDefinition,
} from "../../packages/core/src/index.js";
import { nativeNumbers } from "../../packages/core/src/index.js";
import type { AdState } from "./upstream.js";

type Tx = Parameters<Command<number>["execute"]>[0];

export function adPurchaseCurve(base: number, multiplier: number): PurchaseCurve<number> {
  const unitCost = (count: number) => base * multiplier ** Math.floor(count / 10);
  const totalCost = (start: number, quantity: number) => {
    let total = 0;
    for (let offset = 0; offset < quantity; offset += 1) total += unitCost(start + offset);
    return total;
  };
  const maxAffordable = (balance: number, start: number, maximum = 1_000_000) => {
    let quantity = 0;
    let remaining = balance;
    while (quantity < maximum && remaining >= unitCost(start + quantity)) {
      remaining -= unitCost(start + quantity);
      quantity += 1;
    }
    return quantity;
  };
  return {
    kind: "ad-groups-of-ten",
    numericAdapterId: nativeNumbers.id,
    unitCost,
    totalCost,
    maxAffordable,
  };
}

export function createAdTick(options: {
  readonly scope: SteppedRuleDefinition<number>["scope"];
  readonly dimensions: readonly Resource<number>[];
  readonly buyables: readonly BuyableDefinition<number>[];
  readonly boosts: Resource<number>;
  readonly infinities: Resource<number>;
  readonly totalTimePlayed: Resource<number>;
  readonly antimatter: Resource<number>;
  readonly challengePower: Resource<number>;
  readonly challenges: readonly ChallengeDefinition<number>[];
  readonly initial: Partial<AdState>;
}): Omit<SteppedRuleDefinition<number>, "id" | "priority"> {
  return {
    scope: options.scope,
    update: (tx, seconds) => {
      tx.add(options.totalTimePlayed, seconds * 1000);
      updateChallengePower(tx, options.challenges, options.challengePower, seconds);
      for (let tier = 7; tier >= 1; tier -= 1) {
        tx.add(
          options.dimensions[tier - 1] as Resource<number>,
          (production(tx, tier + 1, options) * seconds) / 10,
        );
      }
      tx.add(options.antimatter, production(tx, 1, options) * seconds);
    },
  };
}

function production(
  tx: Tx,
  tier: number,
  options: {
    readonly dimensions: readonly Resource<number>[];
    readonly buyables: readonly BuyableDefinition<number>[];
    readonly boosts: Resource<number>;
    readonly infinities: Resource<number>;
    readonly totalTimePlayed: Resource<number>;
    readonly challenges: readonly ChallengeDefinition<number>[];
    readonly challengePower: Resource<number>;
    readonly initial: Partial<AdState>;
  },
): number {
  const index = tier - 1;
  if (tier > 6 && tx.isChallengeActive(options.challenges[2]?.id ?? "")) return 0;
  let multiplier = options.initial.multipliers?.[index] ?? 1;
  multiplier *=
    2 ** Math.floor(tx.getPurchase((options.buyables[index] as BuyableDefinition<number>).id) / 10);
  multiplier *= 2 ** Math.max(tx.get(options.boosts) + 1 - tier, 0);
  if (tx.hasProgress("upgrade", "time-mult")) {
    multiplier *= (tx.get(options.totalTimePlayed) / 120_000) ** 0.15;
  }
  if (tx.hasProgress("upgrade", "dim-18-mult") && (tier === 1 || tier === 8))
    multiplier *= tx.get(options.infinities) * 0.2 + 1;
  let value =
    tx.get(options.dimensions[index] as Resource<number>) *
    multiplier *
    (options.initial.tickspeedPerSecond ?? 1);
  if (tx.isChallengeActive(options.challenges[0]?.id ?? ""))
    value *= tx.get(options.challengePower);
  if (tier === 1 && tx.isChallengeActive(options.challenges[1]?.id ?? ""))
    value *= tx.get(options.challengePower);
  return value;
}

function updateChallengePower(
  tx: Tx,
  challenges: readonly ChallengeDefinition<number>[],
  power: Resource<number>,
  seconds: number,
): void {
  if (tx.isChallengeActive(challenges[0]?.id ?? ""))
    tx.set(power, Math.min(tx.get(power) + seconds / 180, 1));
  if (tx.isChallengeActive(challenges[1]?.id ?? ""))
    tx.set(power, Math.min(tx.get(power) * 1.00038 ** (seconds * 10), Number.MAX_VALUE));
}
