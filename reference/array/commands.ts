import {
  type Command,
  type EternityQuantity,
  upgradeCommand,
} from "../../packages/core/src/index.js";
import { add, arrayNumbers, q, sub } from "./math.js";
import {
  arrayGenerators,
  arrayResources,
  arrayScopes,
  aUpgradeBuyables,
  boosterator,
  bUpgrades,
} from "./model.js";
import { arrayBReward } from "./production.js";

export type ArrayIntent =
  | {
      readonly type: "buy-generator";
      readonly family: "A" | "B";
      readonly tier: number;
      readonly mode: "one" | "max";
    }
  | { readonly type: "buy-a-upgrade"; readonly index: number; readonly mode: "one" | "max" }
  | { readonly type: "buy-boosterator"; readonly mode: "one" | "max" }
  | { readonly type: "buy-b-upgrade"; readonly id: string }
  | { readonly type: "prestige-b" };

export function arrayCommand(intent: ArrayIntent): Command<EternityQuantity> {
  if (intent.type === "buy-generator") return buyGenerator(intent.family, intent.tier, intent.mode);
  if (intent.type === "buy-a-upgrade")
    return buyTracked(intent.index, aUpgradeBuyables, intent.mode);
  if (intent.type === "buy-boosterator") return buyTracked(0, [boosterator], intent.mode);
  if (intent.type === "prestige-b") return prestigeBCommand();
  const upgrade = bUpgrades.find((candidate) => candidate.id === intent.id);
  return upgrade ? upgradeCommand(upgrade) : invalid(intent.id);
}

function buyGenerator(
  family: "A" | "B",
  tier: number,
  mode: "one" | "max",
): Command<EternityQuantity> {
  const group = arrayGenerators[family];
  const buyable = group.buyables[tier - 1];
  const amount = group.amounts[tier - 1];
  if (!buyable || !amount) return invalid(`${family}-${tier}`);
  return {
    id: `array-buy-${family.toLowerCase()}-${tier}-${mode}`,
    execute(transaction) {
      if (family === "B" && !transaction.hasProgress("milestone", "array-b-unlocked")) {
        transaction.reject({ code: "locked", prerequisiteIds: ["array-b-unlocked"] });
      }
      const bought = purchase(transaction, buyable, mode);
      transaction.add(amount, bought);
    },
  };
}

function buyTracked(
  index: number,
  buyables: readonly (typeof aUpgradeBuyables)[number][],
  mode: "one" | "max",
): Command<EternityQuantity> {
  const buyable = buyables[index];
  if (!buyable) return invalid(String(index));
  return {
    id: `array-buy-${buyable.id}-${mode}`,
    execute: (transaction) => void purchase(transaction, buyable, mode),
  };
}

function purchase(
  transaction: Parameters<Command<EternityQuantity>["execute"]>[0],
  buyable: (typeof aUpgradeBuyables)[number],
  mode: "one" | "max",
): EternityQuantity {
  const count = transaction.getPurchase(buyable.id);
  const balance = transaction.get(buyable.currency);
  const quantity = mode === "one" ? q("1") : buyable.curve.maxAffordable(balance, count);
  if (arrayNumbers.cmp(quantity, q("0")) <= 0) {
    transaction.reject({
      code: "insufficient",
      resourceId: buyable.currency.id,
      required: buyable.curve.unitCost(count),
      available: balance,
    });
  }
  const cost =
    mode === "one" ? buyable.curve.unitCost(count) : buyable.curve.totalCost(count, quantity);
  if (arrayNumbers.cmp(balance, cost) < 0) {
    transaction.reject({
      code: "insufficient",
      resourceId: buyable.currency.id,
      required: cost,
      available: balance,
    });
  }
  transaction.set(buyable.currency, sub(balance, cost));
  transaction.setPurchase(buyable.id, add(count, quantity));
  return quantity;
}

function prestigeBCommand(): Command<EternityQuantity> {
  return {
    id: "array-prestige-b",
    execute(transaction) {
      const reward = arrayBReward(transaction);
      if (arrayNumbers.cmp(reward, q("1")) < 0) {
        transaction.reject({ code: "locked", prerequisiteIds: ["array-a:1e10"] });
      }
      transaction.reset({ clear: [arrayScopes.a] });
      transaction.add(arrayResources.B, reward);
      transaction.setProgress("milestone", "array-b-unlocked");
    },
  };
}

function invalid(id: string): Command<EternityQuantity> {
  return {
    id: `array-invalid:${id}`,
    execute: (transaction) => transaction.reject({ code: "invalid-target", id }),
  };
}
