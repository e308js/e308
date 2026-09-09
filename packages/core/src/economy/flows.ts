import type { Resource } from "../model/handles.js";
import type { NumericAdapter } from "../numbers/types.js";
import type { Transaction } from "../state/types.js";
import { capacityLimits, combineEntries, maximum, resolveCapacity } from "./entries.js";
import { evaluateRate } from "./rates.js";
import type { FlowDefinition, ReadContext } from "./types.js";

export function runFlows<N>(
  transaction: Transaction<N>,
  flows: readonly FlowDefinition<N>[],
  numbers: NumericAdapter<N>,
  stepSeconds: number,
): void {
  const zero = numbers.fromNumber(0);
  const start = new Map<Resource<N>, N>();
  const inputReservations = new Map<Resource<N>, N>();
  const netChanges = new Map<Resource<N>, N>();
  const readStart: ReadContext<N> = {
    get: (resource) => {
      let value = start.get(resource);
      if (value === undefined) {
        value = transaction.get(resource);
        start.set(resource, value);
      }
      return value;
    },
    getAllocation: (allocation, targetId) => transaction.getAllocation(allocation.id, targetId),
  };

  for (const flow of [...flows].sort(compareFlows)) {
    if (!transaction.isScopeActive(flow.scope)) continue;
    const perSecond = evaluateRate(flow.rate, readStart, numbers);
    let executions = numbers.mul(perSecond, numbers.fromNumber(stepSeconds));
    if (numbers.cmp(executions, zero) < 0 || !numbers.isFinite(executions)) {
      throw new TypeError(`Flow ${flow.id} produced an invalid rate`);
    }
    executions = constrainByInputs(flow, executions, readStart, inputReservations, numbers);
    executions = constrainByCapacity(flow, executions, readStart, netChanges, numbers);
    if (numbers.cmp(executions, zero) === 0) continue;
    reserve(flow.consumes, executions, inputReservations, netChanges, numbers, -1);
    reserve(flow.produces, executions, new Map(), netChanges, numbers, 1);
    for (const [resource, coefficient] of combineEntries(flow.produces, numbers)) {
      transaction.addProduction(resource.id, numbers.mul(coefficient, executions));
    }
  }

  for (const [resource, change] of netChanges) {
    let next = numbers.add(readStart.get(resource), change);
    const capacity = resolveCapacity(resource, (entry) => readStart.get(entry), numbers);
    if (capacity !== undefined && numbers.cmp(next, capacity) > 0) {
      next = capacity;
    }
    transaction.set(resource, next);
  }
}

function constrainByInputs<N>(
  flow: FlowDefinition<N>,
  desired: N,
  start: ReadContext<N>,
  reserved: Map<Resource<N>, N>,
  numbers: NumericAdapter<N>,
): N {
  let feasible = desired;
  for (const [resource, coefficient] of combineEntries(flow.consumes, numbers)) {
    const available = numbers.sub(
      start.get(resource),
      reserved.get(resource) ?? numbers.fromNumber(0),
    );
    const bound = numbers.div(available, coefficient);
    if (numbers.cmp(bound, feasible) < 0) feasible = maximum(bound, numbers.fromNumber(0), numbers);
  }
  if (flow.onInputShortage === "block" && numbers.cmp(feasible, desired) < 0)
    return numbers.fromNumber(0);
  return feasible;
}

function constrainByCapacity<N>(
  flow: FlowDefinition<N>,
  desired: N,
  start: ReadContext<N>,
  changes: Map<Resource<N>, N>,
  numbers: NumericAdapter<N>,
): N {
  let feasible = desired;
  const current = (resource: Resource<N>): N =>
    numbers.add(start.get(resource), changes.get(resource) ?? numbers.fromNumber(0));
  for (const limit of capacityLimits(flow.consumes, flow.produces, current, numbers)) {
    const bound = numbers.div(limit.room, limit.netPerExecution);
    if (numbers.cmp(bound, feasible) < 0) feasible = bound;
  }
  return feasible;
}

function reserve<N>(
  entries: readonly (readonly [Resource<N>, N])[],
  executions: N,
  inputs: Map<Resource<N>, N>,
  changes: Map<Resource<N>, N>,
  numbers: NumericAdapter<N>,
  direction: -1 | 1,
): void {
  for (const [resource, coefficient] of combineEntries(entries, numbers)) {
    const amount = numbers.mul(coefficient, executions);
    if (direction < 0)
      inputs.set(resource, numbers.add(inputs.get(resource) ?? numbers.fromNumber(0), amount));
    const signed = direction < 0 ? numbers.sub(numbers.fromNumber(0), amount) : amount;
    changes.set(resource, numbers.add(changes.get(resource) ?? numbers.fromNumber(0), signed));
  }
}

function compareFlows<N>(left: FlowDefinition<N>, right: FlowDefinition<N>): number {
  if (left.priority !== right.priority) return left.priority - right.priority;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
