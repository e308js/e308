import type { GameDefinition } from "../model/definition.js";
import type { Resource } from "../model/handles.js";
import { ownerOf } from "../model/handles.js";
import { NumericFault } from "../numbers/types.js";
import type { CommandFailure, Transaction } from "./types.js";

export function makeTransaction<N>(
  owner: object,
  working: Record<string, N>,
  purchaseCounts: Record<string, N>,
  allocations: Record<string, Record<string, N>>,
  productionTotals: Record<string, N>,
  numbers: NonNullable<GameDefinition<N>["numbers"]>,
): Transaction<N> {
  const assertResource = (resource: Resource<N>): void => {
    if (ownerOf(resource) !== owner || !(resource.id in working)) {
      throw new InvalidTarget(resource.id);
    }
  };
  return {
    numbers,
    get: (resource) => {
      assertResource(resource);
      return working[resource.id] as N;
    },
    set: (resource, value) => {
      assertResource(resource);
      if (!numbers.isFinite(value)) throw new NumericFault(`Invalid value for ${resource.id}`);
      if (resource.capacity !== undefined && numbers.cmp(value, resource.capacity) > 0) {
        if (resource.overflow === "block") {
          throw new OperationRejected({
            code: "capacity-blocked",
            resourceId: resource.id,
            attempted: value,
            capacity: resource.capacity,
          });
        }
        value = resource.capacity;
      }
      working[resource.id] = value;
    },
    add(resource, amount) {
      this.set(resource, numbers.add(this.get(resource), amount));
    },
    getPurchase: (id) => purchaseCounts[id] ?? numbers.fromNumber(0),
    setPurchase: (id, value) => {
      if (!numbers.isFinite(value)) throw new NumericFault(`Invalid purchase count for ${id}`);
      purchaseCounts[id] = value;
    },
    getAllocation: (id, targetId) => allocations[id]?.[targetId] ?? numbers.fromNumber(0),
    setAllocation: (id, targetId, value) => {
      if (!numbers.isFinite(value))
        throw new NumericFault(`Invalid allocation for ${id}:${targetId}`);
      const allocation = allocations[id];
      if (!allocation || !(targetId in allocation)) throw new InvalidTarget(`${id}:${targetId}`);
      allocation[targetId] = value;
    },
    addProduction: (id, executions) => {
      if (!numbers.isFinite(executions))
        throw new NumericFault(`Invalid production total for ${id}`);
      productionTotals[id] = numbers.add(productionTotals[id] ?? numbers.fromNumber(0), executions);
    },
    reject: (error) => {
      throw new OperationRejected(error);
    },
  };
}

class InvalidTarget extends Error {
  constructor(readonly id: string) {
    super(`Invalid target: ${id}`);
  }
}

class OperationRejected<N> extends Error {
  constructor(readonly failure: CommandFailure<N>) {
    super(failure.code);
  }
}

export function failureFrom<N>(error: unknown): CommandFailure<N> {
  if (error instanceof OperationRejected) return error.failure as CommandFailure<N>;
  if (error instanceof InvalidTarget) return { code: "invalid-target", id: error.id };
  if (error instanceof NumericFault) return { code: "numeric-fault", message: error.message };
  return {
    code: "transaction-failed",
    message: error instanceof Error ? error.message : String(error),
  };
}
