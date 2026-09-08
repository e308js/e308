import type { Resource, Scope } from "../model/handles.js";
import type { Command, Transaction } from "../state/types.js";

export interface AllocationDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly budget: Resource<N>;
  readonly targets: readonly string[];
  readonly initial: Readonly<Record<string, N>>;
}

export function allocationCommand<N>(
  allocation: AllocationDefinition<N>,
  targetId: string,
  amount: N,
): Command<N> {
  return {
    id: `allocate:${allocation.id}:${targetId}`,
    execute: (transaction) => assign(transaction, allocation, targetId, amount),
  };
}

export function validateAllocations<N>(
  transaction: Transaction<N>,
  allocations: readonly AllocationDefinition<N>[],
): void {
  const numbers = transaction.numbers;
  for (const allocation of allocations) {
    let assigned = numbers.fromNumber(0);
    for (const target of allocation.targets) {
      assigned = numbers.add(assigned, transaction.getAllocation(allocation.id, target));
    }
    const budget = transaction.get(allocation.budget);
    if (numbers.cmp(assigned, budget) > 0) {
      transaction.reject({
        code: "allocation-exceeded",
        allocationId: allocation.id,
        assigned,
        budget,
      });
    }
  }
}

function assign<N>(
  transaction: Transaction<N>,
  allocation: AllocationDefinition<N>,
  targetId: string,
  amount: N,
): void {
  const numbers = transaction.numbers;
  const zero = numbers.fromNumber(0);
  if (!allocation.targets.includes(targetId)) {
    transaction.reject({ code: "invalid-target", id: `${allocation.id}:${targetId}` });
  }
  if (!numbers.isFinite(amount) || numbers.cmp(amount, zero) < 0) {
    transaction.reject({ code: "invalid-count", requested: amount });
  }
  let assigned = zero;
  for (const target of allocation.targets) {
    assigned = numbers.add(
      assigned,
      target === targetId ? amount : transaction.getAllocation(allocation.id, target),
    );
  }
  const budget = transaction.get(allocation.budget);
  if (numbers.cmp(assigned, budget) > 0) {
    transaction.reject({
      code: "allocation-exceeded",
      allocationId: allocation.id,
      assigned,
      budget,
    });
  }
  transaction.setAllocation(allocation.id, targetId, amount);
}
