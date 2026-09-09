import type { Resource, Transaction } from "../../../packages/core/src/index.js";

export function spend(
  transaction: Transaction<number>,
  resource: Resource<number>,
  amount: number,
): void {
  requireBalance(transaction, resource, amount);
  transaction.add(resource, -amount);
}

export function requireBalance(
  transaction: Transaction<number>,
  resource: Resource<number>,
  amount: number,
): void {
  const available = transaction.get(resource);
  if (available < amount) {
    transaction.reject({
      code: "insufficient",
      resourceId: resource.id,
      required: amount,
      available,
    });
  }
}
