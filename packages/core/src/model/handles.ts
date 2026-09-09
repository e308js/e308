const ownerSymbol: unique symbol = Symbol("e308.definition-owner");

export interface Scope {
  readonly id: string;
  readonly [ownerSymbol]: object;
}

export interface Resource<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly initial: N;
  readonly capacity?: N;
  readonly capacityFor?: (get: (resource: Resource<N>) => N) => N;
  readonly overflow: "block" | "clamp" | "discard";
  readonly [ownerSymbol]: object;
}

export function owned<T extends object>(value: T, owner: object): T {
  Object.defineProperty(value, ownerSymbol, { enumerable: false, value: owner });
  return Object.freeze(value);
}

export function ownerOf(value: object): object | undefined {
  return (value as { readonly [ownerSymbol]?: object })[ownerSymbol];
}
