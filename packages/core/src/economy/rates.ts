import type { Resource } from "../model/handles.js";
import { ownerOf } from "../model/handles.js";
import type { NumericAdapter } from "../numbers/types.js";
import type { AllocationDefinition } from "./allocations.js";
import type { Rate, ReadContext } from "./types.js";

export function evaluateRate<N>(
  rate: Rate<N>,
  state: ReadContext<N>,
  numbers: NumericAdapter<N>,
): N {
  switch (rate.kind) {
    case "constant":
      return rate.value;
    case "proportional":
      return numbers.mul(state.get(rate.resource), rate.factor);
    case "allocated":
      return numbers.mul(state.getAllocation(rate.allocation, rate.targetId), rate.factor);
    case "product":
      return rate.factors.reduce(
        (value, factor) => numbers.mul(value, evaluateRate(factor, state, numbers)),
        numbers.fromNumber(1),
      );
    case "custom":
      return rate.evaluate(state);
  }
}

export interface RateBuilders<N> {
  constant(value: N): Rate<N>;
  proportional(resource: Resource<N>, factor: N): Rate<N>;
  allocated(allocation: AllocationDefinition<N>, targetId: string, factor: N): Rate<N>;
  product(...factors: readonly Rate<N>[]): Rate<N>;
  custom(evaluate: (state: ReadContext<N>) => N): Rate<N>;
}

export function createRateBuilders<N>(owner: object, numbers: NumericAdapter<N>): RateBuilders<N> {
  return Object.freeze({
    constant: (value: N): Rate<N> => {
      if (!numbers.isFinite(value)) throw new TypeError("Constant rate must be finite");
      return Object.freeze({ kind: "constant", value });
    },
    proportional: (resource: Resource<N>, factor: N): Rate<N> => {
      if (ownerOf(resource) !== owner)
        throw new TypeError("Rate resource belongs to another game kit");
      if (!numbers.isFinite(factor)) throw new TypeError("Rate factor must be finite");
      return Object.freeze({ kind: "proportional", resource, factor });
    },
    allocated: (allocation: AllocationDefinition<N>, targetId: string, factor: N): Rate<N> => {
      if (ownerOf(allocation) !== owner)
        throw new TypeError("Allocation belongs to another game kit");
      if (!allocation.targets.includes(targetId))
        throw new TypeError(`Unknown allocation target: ${targetId}`);
      if (!numbers.isFinite(factor)) throw new TypeError("Rate factor must be finite");
      return Object.freeze({ kind: "allocated", allocation, targetId, factor });
    },
    product: (...factors: readonly Rate<N>[]): Rate<N> => {
      if (factors.length === 0) throw new TypeError("Product rate requires at least one factor");
      return Object.freeze({ kind: "product", factors: Object.freeze([...factors]) });
    },
    custom: (evaluate: (state: ReadContext<N>) => N): Rate<N> =>
      Object.freeze({ kind: "custom", evaluate }),
  });
}
