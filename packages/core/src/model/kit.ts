import type { NumericAdapter } from "../numbers/types.js";
import { defineOwnedGame } from "./definition.js";
import type { GameKit, Resource, Scope } from "./handles.js";
import { owned, ownerOf } from "./handles.js";

const ID_PATTERN = /^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/;

function validId(id: string, kind: string): void {
  if (!ID_PATTERN.test(id)) throw new TypeError(`Invalid ${kind} id: ${id}`);
}

export function createGameKit<N>(options: { readonly numbers: NumericAdapter<N> }): GameKit<N> {
  const owner = Object.freeze({});
  const numbers = options.numbers;
  const kit: GameKit<N> = {
    numbers,
    q: (encoded: string | number) =>
      typeof encoded === "number" ? numbers.fromNumber(encoded) : numbers.fromString(encoded),
    scope: (id: string): Scope => {
      validId(id, "scope");
      return owned({ id } as Scope, owner);
    },
    resource: (
      id: string,
      resourceOptions: { readonly scope: Scope; readonly initial: N },
    ): Resource<N> => {
      validId(id, "resource");
      if (ownerOf(resourceOptions.scope) !== owner)
        throw new TypeError(`Scope for ${id} belongs to another game kit`);
      if (!numbers.isFinite(resourceOptions.initial))
        throw new TypeError(`Initial value for ${id} must be finite`);
      return owned(
        { id, scope: resourceOptions.scope, initial: resourceOptions.initial } as Resource<N>,
        owner,
      );
    },
    defineGame: (input) => defineOwnedGame({ ...input, numbers }, owner),
  };
  return Object.freeze(kit);
}
