import type { NumericAdapter } from "./types.js";
import { NumericFault, requireFinite } from "./types.js";

const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i;

function fromNumber(value: number): number {
  if (!Number.isFinite(value)) throw new NumericFault("native number must be finite");
  return value;
}

function fromString(encoded: string): number {
  if (!DECIMAL.test(encoded)) throw new NumericFault("invalid native decimal encoding");
  return fromNumber(Number(encoded));
}

function operation(name: string, apply: () => number): number {
  return requireFinite(nativeNumbers, apply(), name);
}

const adapter: NumericAdapter<number> = {
  id: "native",
  implementationVersion: "1",
  codec: Object.freeze({
    id: "native-decimal",
    version: 1,
    serialize: (value: number) => String(fromNumber(value)),
    parse: fromString,
  }),
  fromNumber,
  fromString,
  add: (left, right) => operation("add", () => left + right),
  sub: (left, right) => operation("sub", () => left - right),
  mul: (left, right) => operation("mul", () => left * right),
  div: (left, right) => operation("div", () => left / right),
  cmp: (left, right) => (left < right ? -1 : left > right ? 1 : 0),
  floor: (value) => Math.floor(value),
  isFinite: Number.isFinite,
  transcendental: Object.freeze({
    pow: (base, exponent) => operation("pow", () => base ** exponent),
    log: (value, base) => operation("log", () => Math.log(value) / Math.log(base)),
  }),
};

export const nativeNumbers = Object.freeze(adapter);
