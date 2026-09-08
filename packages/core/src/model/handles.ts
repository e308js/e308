import type { NumericAdapter } from "../numbers/types.js";

const ownerSymbol: unique symbol = Symbol("e308.definition-owner");

export interface Scope {
  readonly id: string;
  readonly [ownerSymbol]: object;
}

export interface Resource<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly initial: N;
  readonly [ownerSymbol]: object;
}

export interface GameKit<N> {
  readonly numbers: NumericAdapter<N>;
  q(encoded: string | number): N;
  scope(id: string): Scope;
  resource(id: string, options: { readonly scope: Scope; readonly initial: N }): Resource<N>;
  defineGame(options: {
    readonly id: string;
    readonly simulationVersion: number;
    readonly stepMs: number;
    readonly resources: readonly Resource<N>[];
  }): import("./definition.js").GameDefinition<N>;
}

export function owned<T extends object>(value: T, owner: object): T {
  Object.defineProperty(value, ownerSymbol, { enumerable: false, value: owner });
  return Object.freeze(value);
}

export function ownerOf(value: object): object | undefined {
  return (value as { readonly [ownerSymbol]?: object })[ownerSymbol];
}
