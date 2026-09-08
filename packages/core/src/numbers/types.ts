export interface NumericCodec<N> {
  readonly id: string;
  readonly version: number;
  serialize(value: N): string;
  parse(encoded: string): N;
}

export interface NumericAdapter<N> {
  readonly id: string;
  readonly implementationVersion: string;
  readonly codec: NumericCodec<N>;
  fromNumber(value: number): N;
  fromString(value: string): N;
  add(left: N, right: N): N;
  sub(left: N, right: N): N;
  mul(left: N, right: N): N;
  div(left: N, right: N): N;
  cmp(left: N, right: N): -1 | 0 | 1;
  floor(value: N): N;
  isFinite(value: N): boolean;
  readonly transcendental?: {
    pow(base: N, exponent: N): N;
    log(value: N, base: N): N;
  };
}

export class NumericFault extends Error {
  readonly code = "numeric-fault";

  constructor(message: string) {
    super(message);
    this.name = "NumericFault";
  }
}

export function requireFinite<N>(adapter: NumericAdapter<N>, value: N, operation: string): N {
  if (!adapter.isFinite(value)) throw new NumericFault(`${operation} produced a non-finite value`);
  return value;
}
