import type { Resource, Transaction } from "../../../packages/core/src/index.js";

export interface WirePurchaseResources {
  readonly funds: Resource<number>;
  readonly wire: Resource<number>;
  readonly wireBasePrice: Resource<number>;
  readonly wireCost: Resource<number>;
  readonly wirePriceTimer: Resource<number>;
  readonly wireSupply: Resource<number>;
}

export function purchaseWire(
  transaction: Transaction<number>,
  resources: WirePurchaseResources,
): boolean {
  const cost = transaction.get(resources.wireCost);
  if (transaction.get(resources.funds) < cost) return false;
  transaction.add(resources.funds, -cost);
  transaction.add(resources.wire, transaction.get(resources.wireSupply));
  transaction.set(resources.wirePriceTimer, 0);
  transaction.add(resources.wireBasePrice, 0.05);
  return true;
}
