import type { Resource, Scope } from "../model/handles.js";
import type { Command, Transaction } from "../state/types.js";
import type { PurchaseCurve } from "./curves.js";

export interface BuyableDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly currency: Resource<N>;
  readonly curve: PurchaseCurve<N>;
  readonly initialCount: N;
  readonly refundRate: N;
}

export type BuyRequest<N> =
  | { readonly mode: "exact"; readonly count: N }
  | { readonly mode: "max"; readonly maximum?: N };

export function buyCommand<N>(buyable: BuyableDefinition<N>, request: BuyRequest<N>): Command<N> {
  return {
    id: `buy:${buyable.id}`,
    execute: (transaction) => executeBuy(transaction, buyable, request),
  };
}

export function sellCommand<N>(buyable: BuyableDefinition<N>, count?: N): Command<N> {
  return {
    id: `sell:${buyable.id}`,
    execute: (transaction) => executeSell(transaction, buyable, count),
  };
}

function executeBuy<N>(
  transaction: Transaction<N>,
  buyable: BuyableDefinition<N>,
  request: BuyRequest<N>,
): void {
  assertActive(transaction, buyable);
  const numbers = transaction.numbers;
  const zero = numbers.fromNumber(0);
  const current = transaction.getPurchase(buyable.id);
  const balance = transaction.get(buyable.currency);
  const count =
    request.mode === "exact"
      ? request.count
      : buyable.curve.maxAffordable(balance, current, request.maximum);
  if (!isPositiveWhole(count, numbers)) {
    if (request.mode === "max" && numbers.cmp(count, zero) === 0) {
      transaction.reject({
        code: "insufficient",
        resourceId: buyable.currency.id,
        required: buyable.curve.unitCost(current),
        available: balance,
      });
    }
    transaction.reject({ code: "invalid-count", requested: count });
  }
  const cost = buyable.curve.totalCost(current, count);
  if (numbers.cmp(balance, cost) < 0) {
    transaction.reject({
      code: "insufficient",
      resourceId: buyable.currency.id,
      required: cost,
      available: balance,
    });
  }
  transaction.set(buyable.currency, numbers.sub(balance, cost));
  transaction.setPurchase(buyable.id, numbers.add(current, count));
  if (numbers.cmp(transaction.getPurchase(buyable.id), zero) < 0) {
    throw new TypeError("purchase count became negative");
  }
}

function executeSell<N>(
  transaction: Transaction<N>,
  buyable: BuyableDefinition<N>,
  requested: N | undefined,
): void {
  assertActive(transaction, buyable);
  const numbers = transaction.numbers;
  const owned = transaction.getPurchase(buyable.id);
  const count = requested ?? owned;
  if (!isPositiveWhole(count, numbers) || numbers.cmp(count, owned) > 0) {
    transaction.reject({ code: "invalid-count", requested: count });
  }
  const remaining = numbers.sub(owned, count);
  const paid = buyable.curve.totalCost(remaining, count);
  const refund = numbers.mul(paid, buyable.refundRate);
  transaction.setPurchase(buyable.id, remaining);
  transaction.add(buyable.currency, refund);
}

function assertActive<N>(transaction: Transaction<N>, buyable: BuyableDefinition<N>): void {
  if (!transaction.isScopeActive(buyable.scope))
    transaction.reject({ code: "disabled", actionId: buyable.id, reasonKey: "scope-inactive" });
}

function isPositiveWhole<N>(value: N, numbers: Transaction<N>["numbers"]): boolean {
  return (
    numbers.isFinite(value) &&
    numbers.cmp(value, numbers.fromNumber(0)) > 0 &&
    numbers.cmp(numbers.floor(value), value) === 0
  );
}
