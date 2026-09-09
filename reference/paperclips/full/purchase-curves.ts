import { nativeNumbers, type PurchaseCurve } from "../../../packages/core/src/index.js";

export function sourcePurchaseCurve(
  kind: string,
  unitCost: (count: number) => number,
): PurchaseCurve<number> {
  const totalCost = (startCount: number, quantity: number): number => {
    requireCount(startCount);
    requireCount(quantity);
    let total = 0;
    for (let offset = 0; offset < quantity; offset += 1) total += unitCost(startCount + offset);
    return total;
  };
  const maxAffordable = (balance: number, startCount: number, maximum?: number): number => {
    requireCount(startCount);
    if (maximum !== undefined) requireCount(maximum);
    if (!Number.isFinite(balance) || balance < 0) {
      throw new TypeError("Paperclips purchase balance must be a nonnegative finite number");
    }
    let bought = 0;
    let spent = 0;
    while (maximum === undefined || bought < maximum) {
      const next = unitCost(startCount + bought);
      if (spent + next > balance) break;
      spent += next;
      bought += 1;
    }
    return bought;
  };
  return Object.freeze({
    kind,
    numericAdapterId: nativeNumbers.id,
    unitCost: (count: number) => {
      requireCount(count);
      return unitCost(count);
    },
    totalCost,
    maxAffordable,
  });
}

export const autoClipperCurve = sourcePurchaseCurve("paperclips-auto-clipper", (count) =>
  count === 0 ? 5 : 1.1 ** count + 5,
);

export const megaClipperCurve = sourcePurchaseCurve("paperclips-mega-clipper", (count) =>
  count === 0 ? 500 : 1_000 * 1.07 ** count,
);

function requireCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Paperclips purchase count must be a nonnegative safe integer");
  }
}
