import {
  type EternityQuantity,
  eternityNumbers,
  geometricCurve,
  type NumericAdapter,
  type PurchaseCurve,
} from "../../packages/core/src/index.js";

export type ArrayQuantity = EternityQuantity;
export const arrayNumbers: NumericAdapter<ArrayQuantity> = eternityNumbers;
export const q = eternityNumbers.fromString;

const transcendental = eternityNumbers.transcendental as NonNullable<
  typeof eternityNumbers.transcendental
>;

export const pow = transcendental.pow;
export const log = transcendental.log;
export const encode = eternityNumbers.codec.serialize;
export const add = eternityNumbers.add;
export const sub = eternityNumbers.sub;
export const mul = eternityNumbers.mul;
export const div = eternityNumbers.div;
export const floor = eternityNumbers.floor;
export const compare = eternityNumbers.cmp;

export function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new TypeError(`Array Game is missing ${label}`);
  return value;
}

/** Matches Array Game's floored single price and geometric-series bulk price. */
export function arrayGeometricCurve(
  base: ArrayQuantity,
  ratio: ArrayQuantity,
): PurchaseCurve<ArrayQuantity> {
  const bulk = geometricCurve(eternityNumbers, { base, ratio });
  return Object.freeze({
    ...bulk,
    kind: "array-game-geometric-single-floor",
    unitCost: (count: ArrayQuantity) => floor(bulk.unitCost(count)),
  });
}
