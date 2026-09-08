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
}

export interface GameDefinitionInput {
  readonly id: string;
  readonly simulationVersion: number;
  readonly stepMs: number;
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
  input: GameDefinitionInput & {
    readonly numbers: NumericAdapter<N>;
    readonly resources: readonly Resource<N>[];
  },
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
  return owned(
    {
      ...base,
      numbers: input.numbers,
      resources: Object.freeze([...input.resources]),
    },
    owner,
  );
}

export function definitionOwner<N>(definition: GameDefinition<N>): object {
  const owner = ownerOf(definition);
  if (!owner) throw new TypeError("Game definition has no owner");
  return owner;
}
