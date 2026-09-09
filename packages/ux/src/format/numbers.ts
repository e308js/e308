import type { NumericAdapter } from "@e308/core";

export type QuantityNotation = "plain" | "scientific" | "engineering";

export interface QuantityFormatOptions {
  readonly notation?: QuantityNotation;
  readonly significantDigits?: number;
  readonly trimTrailingZeros?: boolean;
}

export interface QuantityFormatter<N> {
  format(value: N, options?: QuantityFormatOptions | string): string;
}

interface ScientificParts {
  readonly negative: boolean;
  readonly coefficient: number;
  readonly exponent: number;
}

export function createQuantityFormatter<N>(
  adapter: NumericAdapter<N>,
  named: Readonly<Record<string, QuantityFormatOptions>> = {},
): QuantityFormatter<N> {
  return {
    format(value, options = {}) {
      if (!adapter.isFinite(value)) throw new TypeError("cannot format a non-finite quantity");
      const resolved = typeof options === "string" ? named[options] : options;
      if (!resolved) throw new TypeError(`unknown quantity format: ${options}`);
      return formatEncoded(adapter.codec.serialize(value), resolved);
    },
  };
}

export function formatEncoded(encoded: string, options: QuantityFormatOptions = {}): string {
  const digits = options.significantDigits ?? 6;
  if (!Number.isSafeInteger(digits) || digits < 1 || digits > 20) {
    throw new RangeError("significantDigits must be an integer from 1 through 20");
  }
  const parts = scientificParts(encoded);
  const notation =
    options.notation ?? (parts && Math.abs(parts.exponent) >= 6 ? "scientific" : "plain");
  if (!parts || notation === "plain") return encoded;
  const exponent = notation === "engineering" ? Math.floor(parts.exponent / 3) * 3 : parts.exponent;
  const coefficient = parts.coefficient * 10 ** (parts.exponent - exponent);
  let rendered = coefficient.toPrecision(digits);
  if (options.trimTrailingZeros !== false) rendered = trimZeros(rendered);
  return `${parts.negative ? "-" : ""}${rendered}e${exponent >= 0 ? "+" : ""}${exponent}`;
}

function scientificParts(encoded: string): ScientificParts | undefined {
  const match = /^(-)?(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(encoded);
  if (!match) return undefined;
  const integer = match[2] ?? "0";
  const fraction = match[3] ?? "";
  const all = `${integer}${fraction}`;
  const nonzero = all.search(/[1-9]/);
  if (nonzero < 0) return { negative: false, coefficient: 0, exponent: 0 };
  const explicit = Number(match[4] ?? 0);
  const exponent = explicit + integer.length - nonzero - 1;
  const significant = all.slice(nonzero, nonzero + 17);
  const coefficient = Number(`${significant[0]}.${significant.slice(1)}`);
  return { negative: match[1] === "-", coefficient, exponent };
}

function trimZeros(value: string): string {
  const [coefficient, exponent] = value.split("e");
  const trimmed = (coefficient ?? value).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return exponent === undefined ? trimmed : `${trimmed}e${exponent}`;
}
