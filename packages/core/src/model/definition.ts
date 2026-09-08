import type { AllocationDefinition } from "../economy/allocations.js";
import type { BuyableDefinition } from "../economy/buyables.js";
import type { RecipeDefinition } from "../economy/recipes.js";
import type { FlowDefinition } from "../economy/types.js";
import type { NumericAdapter } from "../numbers/types.js";

declare const gameIdBrand: unique symbol;

import type { Resource } from "./handles.js";
import { owned, ownerOf } from "./handles.js";

export type GameId = string & { readonly [gameIdBrand]: true };

export interface GameDefinition<N = never> {
  readonly id: GameId;
  readonly simulationVersion: number;
  readonly stepMs: number;
  readonly numbers?: NumericAdapter<N>;
  readonly resources?: readonly Resource<N>[];
  readonly flows?: readonly FlowDefinition<N>[];
  readonly buyables?: readonly BuyableDefinition<N>[];
  readonly recipes?: readonly RecipeDefinition<N>[];
  readonly allocations?: readonly AllocationDefinition<N>[];
}

export interface GameDefinitionInput {
  readonly id: string;
  readonly simulationVersion: number;
  readonly stepMs: number;
}

export interface GameContentInput<N> extends GameDefinitionInput {
  readonly resources: readonly Resource<N>[];
  readonly flows?: readonly FlowDefinition<N>[];
  readonly buyables?: readonly BuyableDefinition<N>[];
  readonly recipes?: readonly RecipeDefinition<N>[];
  readonly allocations?: readonly AllocationDefinition<N>[];
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export function defineGame(input: GameDefinitionInput): GameDefinition {
  if (!ID_PATTERN.test(input.id)) {
    throw new TypeError(`Invalid game id: ${input.id}`);
  }
  if (!Number.isSafeInteger(input.simulationVersion) || input.simulationVersion < 1) {
    throw new TypeError("simulationVersion must be a positive safe integer");
  }
  if (!Number.isSafeInteger(input.stepMs) || input.stepMs < 1) {
    throw new TypeError("stepMs must be a positive safe integer");
  }
  return Object.freeze({
    id: input.id as GameId,
    simulationVersion: input.simulationVersion,
    stepMs: input.stepMs,
  });
}

export function defineOwnedGame<N>(
  input: GameContentInput<N> & { readonly numbers: NumericAdapter<N> },
  owner: object,
): GameDefinition<N> {
  const base = defineGame(input);
  const seen = new Set<string>();
  for (const resource of input.resources) {
    if (ownerOf(resource) !== owner)
      throw new TypeError(`Resource ${resource.id} belongs to another game kit`);
    if (seen.has(resource.id)) throw new TypeError(`Duplicate resource id: ${resource.id}`);
    seen.add(resource.id);
  }
  const flowIds = new Set<string>();
  for (const flow of input.flows ?? []) {
    if (ownerOf(flow) !== owner) throw new TypeError(`Flow ${flow.id} belongs to another game kit`);
    if (flowIds.has(flow.id)) throw new TypeError(`Duplicate flow id: ${flow.id}`);
    flowIds.add(flow.id);
  }
  const buyableIds = new Set<string>();
  for (const buyable of input.buyables ?? []) {
    if (ownerOf(buyable) !== owner)
      throw new TypeError(`Buyable ${buyable.id} belongs to another game kit`);
    if (buyableIds.has(buyable.id)) throw new TypeError(`Duplicate buyable id: ${buyable.id}`);
    buyableIds.add(buyable.id);
  }
  validateOwnedIds(input.recipes ?? [], owner, "Recipe");
  validateOwnedIds(input.allocations ?? [], owner, "Allocation");
  return owned(
    {
      ...base,
      numbers: input.numbers,
      resources: Object.freeze([...input.resources]),
      flows: Object.freeze([...(input.flows ?? [])]),
      buyables: Object.freeze([...(input.buyables ?? [])]),
      recipes: Object.freeze([...(input.recipes ?? [])]),
      allocations: Object.freeze([...(input.allocations ?? [])]),
    },
    owner,
  );
}

function validateOwnedIds(
  values: readonly { readonly id: string }[],
  owner: object,
  kind: string,
): void {
  const ids = new Set<string>();
  for (const value of values) {
    if (ownerOf(value) !== owner)
      throw new TypeError(`${kind} ${value.id} belongs to another game kit`);
    if (ids.has(value.id)) throw new TypeError(`Duplicate ${kind.toLowerCase()} id: ${value.id}`);
    ids.add(value.id);
  }
}

export function definitionOwner<N>(definition: GameDefinition<N>): object {
  const owner = ownerOf(definition);
  if (!owner) throw new TypeError("Game definition has no owner");
  return owner;
}
