import type { Resource } from "../model/handles.js";
import type { NumericAdapter } from "../numbers/types.js";

export function combineEntries<N>(
  entries: readonly (readonly [Resource<N>, N])[],
  numbers: NumericAdapter<N>,
): readonly (readonly [Resource<N>, N])[] {
  const totals = new Map<Resource<N>, N>();
  for (const [resource, amount] of entries) {
    totals.set(resource, numbers.add(totals.get(resource) ?? numbers.fromNumber(0), amount));
  }
  return [...totals];
}

export interface CapacityLimit<N> {
  readonly resource: Resource<N>;
  readonly capacity: N;
  readonly netPerExecution: N;
  readonly room: N;
}

export function resolveCapacity<N>(
  resource: Resource<N>,
  current: (resource: Resource<N>) => N,
  numbers: NumericAdapter<N>,
): N | undefined {
  const capacity = resource.capacityFor?.(current) ?? resource.capacity;
  if (capacity === undefined) return undefined;
  if (!numbers.isFinite(capacity) || numbers.cmp(capacity, numbers.fromNumber(0)) < 0)
    throw new TypeError(`Resource ${resource.id} returned an invalid capacity`);
  return capacity;
}

export function capacityLimits<N>(
  inputs: readonly (readonly [Resource<N>, N])[],
  outputs: readonly (readonly [Resource<N>, N])[],
  current: (resource: Resource<N>) => N,
  numbers: NumericAdapter<N>,
): readonly CapacityLimit<N>[] {
  const limits: CapacityLimit<N>[] = [];
  const consumed = new Map(combineEntries(inputs, numbers));
  for (const [resource, produced] of combineEntries(outputs, numbers)) {
    const capacity = resolveCapacity(resource, current, numbers);
    if (capacity === undefined || resource.overflow !== "block") continue;
    const netPerExecution = numbers.sub(produced, consumed.get(resource) ?? numbers.fromNumber(0));
    if (numbers.cmp(netPerExecution, numbers.fromNumber(0)) <= 0) continue;
    limits.push({
      resource,
      capacity,
      netPerExecution,
      room: maximum(numbers.sub(capacity, current(resource)), numbers.fromNumber(0), numbers),
    });
  }
  return limits;
}

export function maximum<N>(left: N, right: N, numbers: NumericAdapter<N>): N {
  return numbers.cmp(left, right) >= 0 ? left : right;
}
