import type { NumericAdapter } from "../numbers/types.js";
import type { Resource } from "./handles.js";
import { ownerOf } from "./handles.js";

const ID_PATTERN = /^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/;

export function validId(id: string, kind: string): void {
  if (!ID_PATTERN.test(id)) throw new TypeError(`Invalid ${kind} id: ${id}`);
}

export function assertOwner(value: object, owner: object, label: string): void {
  if (ownerOf(value) !== owner) throw new TypeError(`${label} belongs to another game kit`);
}

export function safePriority(value: number | undefined, id: string): number {
  const priority = value ?? 0;
  if (!Number.isSafeInteger(priority))
    throw new TypeError(`Priority for ${id} must be a safe integer`);
  return priority;
}

export function freezeEntries<N>(
  entries: readonly (readonly [Resource<N>, N])[],
  owner: object,
  numbers: NumericAdapter<N>,
  id: string,
): readonly (readonly [Resource<N>, N])[] {
  const zero = numbers.fromNumber(0);
  return Object.freeze(
    entries.map(([resource, coefficient]) => {
      assertOwner(resource, owner, `Mechanic ${id} resource`);
      if (!numbers.isFinite(coefficient) || numbers.cmp(coefficient, zero) <= 0) {
        throw new TypeError(`Mechanic ${id} coefficients must be positive and finite`);
      }
      return Object.freeze([resource, coefficient] as const);
    }),
  );
}
