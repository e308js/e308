import DecimalModule from "break_eternity.js";
import type { NumericAdapter } from "./types.js";
import { NumericFault, requireFinite } from "./types.js";

declare const eternityBrand: unique symbol;

export interface EternityQuantity {
  readonly [eternityBrand]: true;
}

interface DecimalValue {
  add(value: DecimalValue): DecimalValue;
  cmp(value: DecimalValue): -1 | 0 | 1;
  div(value: DecimalValue): DecimalValue;
  floor(): DecimalValue;
  isFinite(): boolean;
  log(value: DecimalValue): DecimalValue;
  mul(value: DecimalValue): DecimalValue;
  pow(value: DecimalValue): DecimalValue;
  sub(value: DecimalValue): DecimalValue;
  toString(): string;
}

interface DecimalConstructor {
  fromNumber(value: number): DecimalValue;
  fromString(value: string): DecimalValue;
}

const Decimal = DecimalModule as unknown as DecimalConstructor;
const values = new WeakMap<object, DecimalValue>();

function wrap(value: DecimalValue): EternityQuantity {
  if (!value.isFinite()) throw new NumericFault("eternity operation produced a non-finite value");
  const quantity = Object.freeze({}) as EternityQuantity;
  values.set(quantity, value);
  return quantity;
}

function unwrap(value: EternityQuantity): DecimalValue {
  const decimal = values.get(value);
  if (!decimal) throw new NumericFault("quantity belongs to a different numeric implementation");
  return decimal;
}

function parse(encoded: string): EternityQuantity {
  if (encoded.trim() !== encoded || encoded.length === 0) {
    throw new NumericFault("invalid eternity decimal encoding");
  }
  return wrap(Decimal.fromString(encoded));
}

function checked(apply: () => DecimalValue, operation: string): EternityQuantity {
  return requireFinite(eternityNumbers, wrap(apply()), operation);
}

const adapter: NumericAdapter<EternityQuantity> = {
  id: "break-eternity",
  implementationVersion: "2.1.3-e308.1",
  codec: Object.freeze({
    id: "break-eternity-string",
    version: 1,
    serialize: (value: EternityQuantity) => unwrap(value).toString(),
    parse,
  }),
  fromNumber: (value) => wrap(Decimal.fromNumber(value)),
  fromString: parse,
  add: (left, right) => checked(() => unwrap(left).add(unwrap(right)), "add"),
  sub: (left, right) => checked(() => unwrap(left).sub(unwrap(right)), "sub"),
  mul: (left, right) => checked(() => unwrap(left).mul(unwrap(right)), "mul"),
  div: (left, right) => checked(() => unwrap(left).div(unwrap(right)), "div"),
  cmp: (left, right) => unwrap(left).cmp(unwrap(right)),
  floor: (value) => wrap(unwrap(value).floor()),
  isFinite: (value) => values.get(value)?.isFinite() === true,
  transcendental: Object.freeze({
    pow: (base, exponent) => checked(() => unwrap(base).pow(unwrap(exponent)), "pow"),
    log: (value, base) => checked(() => unwrap(value).log(unwrap(base)), "log"),
  }),
};

export const eternityNumbers = Object.freeze(adapter);
