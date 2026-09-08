import type { Resource, Scope } from "../model/handles.js";
import type { Command, Transaction } from "../state/types.js";
import { capacityLimits, combineEntries } from "./entries.js";

export interface RecipeDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly consumes: readonly (readonly [Resource<N>, N])[];
  readonly produces: readonly (readonly [Resource<N>, N])[];
}

export interface RecipeRequest {
  readonly count: number;
  readonly mode?: "exact" | "up-to";
}

export function recipeCommand<N>(recipe: RecipeDefinition<N>, request: RecipeRequest): Command<N> {
  return {
    id: `recipe:${recipe.id}`,
    execute: (transaction) => executeRecipe(transaction, recipe, request),
  };
}

function executeRecipe<N>(
  transaction: Transaction<N>,
  recipe: RecipeDefinition<N>,
  request: RecipeRequest,
): void {
  const numbers = transaction.numbers;
  if (!Number.isSafeInteger(request.count) || request.count < 1) {
    transaction.reject({ code: "invalid-count", requested: request.count });
  }
  const desired = numbers.fromNumber(request.count);
  const inputs = combineEntries(recipe.consumes, transaction.numbers);
  const outputs = combineEntries(recipe.produces, transaction.numbers);
  let feasible = desired;
  let blocker: { resource: Resource<N>; required: N; available: N } | undefined;
  for (const [resource, coefficient] of inputs) {
    const available = transaction.get(resource);
    const possible = numbers.floor(numbers.div(available, coefficient));
    if (numbers.cmp(possible, feasible) < 0) feasible = possible;
    if (!blocker && numbers.cmp(available, numbers.mul(coefficient, desired)) < 0) {
      blocker = { resource, required: numbers.mul(coefficient, desired), available };
    }
  }
  feasible = constrainOutputCapacity(
    feasible,
    desired,
    inputs,
    outputs,
    transaction,
    request.mode,
    blocker,
  );
  if (request.mode !== "up-to" && numbers.cmp(feasible, desired) < 0 && blocker) {
    transaction.reject({
      code: "insufficient",
      resourceId: blocker.resource.id,
      required: blocker.required,
      available: blocker.available,
    });
  }
  if (numbers.cmp(feasible, numbers.fromNumber(0)) <= 0) {
    const first = blocker ?? {
      resource: inputs[0]?.[0],
      required: inputs[0]?.[1],
      available: undefined,
    };
    if (first.resource && first.required !== undefined) {
      transaction.reject({
        code: "insufficient",
        resourceId: first.resource.id,
        required: first.required,
        available: first.available ?? transaction.get(first.resource),
      });
    }
    transaction.reject({ code: "invalid-count", requested: request.count });
  }
  applyRecipe(inputs, outputs, feasible, transaction);
}

function constrainOutputCapacity<N>(
  feasible: N,
  desired: N,
  inputs: readonly (readonly [Resource<N>, N])[],
  outputs: readonly (readonly [Resource<N>, N])[],
  transaction: Transaction<N>,
  mode: RecipeRequest["mode"],
  inputBlocker: unknown,
): N {
  const numbers = transaction.numbers;
  for (const limit of capacityLimits(
    inputs,
    outputs,
    (resource) => transaction.get(resource),
    numbers,
  )) {
    const possible = numbers.floor(numbers.div(limit.room, limit.netPerExecution));
    if (numbers.cmp(possible, feasible) < 0) feasible = possible;
    if (numbers.cmp(possible, numbers.fromNumber(0)) <= 0 && !inputBlocker) {
      transaction.reject({
        code: "capacity-blocked",
        resourceId: limit.resource.id,
        attempted: numbers.add(
          transaction.get(limit.resource),
          numbers.mul(limit.netPerExecution, desired),
        ),
        capacity: limit.capacity,
      });
    }
    if (mode !== "up-to" && !inputBlocker && numbers.cmp(possible, desired) < 0) {
      transaction.reject({
        code: "capacity-blocked",
        resourceId: limit.resource.id,
        attempted: numbers.add(
          transaction.get(limit.resource),
          numbers.mul(limit.netPerExecution, desired),
        ),
        capacity: limit.capacity,
      });
    }
  }
  return feasible;
}

function applyRecipe<N>(
  inputs: readonly (readonly [Resource<N>, N])[],
  outputs: readonly (readonly [Resource<N>, N])[],
  count: N,
  transaction: Transaction<N>,
): void {
  const numbers = transaction.numbers;
  const changes = new Map<Resource<N>, N>();
  for (const [resource, coefficient] of inputs) {
    changes.set(
      resource,
      numbers.sub(changes.get(resource) ?? numbers.fromNumber(0), numbers.mul(coefficient, count)),
    );
  }
  for (const [resource, coefficient] of outputs) {
    changes.set(
      resource,
      numbers.add(changes.get(resource) ?? numbers.fromNumber(0), numbers.mul(coefficient, count)),
    );
  }
  for (const [resource, change] of changes) transaction.add(resource, change);
}
