import type { Resource, Scope } from "../model/handles.js";
import type { AllocationDefinition } from "./allocations.js";
import type { BuyableDefinition } from "./buyables.js";

export interface ReadContext<N> {
  get(resource: Resource<N>): N;
  getAllocation(allocation: AllocationDefinition<N>, targetId: string): N;
  purchaseCount(id: string): N;
}

export type Rate<N> =
  | { readonly kind: "constant"; readonly value: N }
  | { readonly kind: "proportional"; readonly resource: Resource<N>; readonly factor: N }
  | { readonly kind: "purchased"; readonly buyable: BuyableDefinition<N>; readonly factor: N }
  | {
      readonly kind: "allocated";
      readonly allocation: AllocationDefinition<N>;
      readonly targetId: string;
      readonly factor: N;
    }
  | { readonly kind: "sum"; readonly terms: readonly Rate<N>[] }
  | { readonly kind: "product"; readonly factors: readonly Rate<N>[] }
  | { readonly kind: "custom"; readonly evaluate: (state: ReadContext<N>) => N };

export interface FlowDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly priority: number;
  readonly rate: Rate<N>;
  readonly consumes: readonly (readonly [Resource<N>, N])[];
  readonly produces: readonly (readonly [Resource<N>, N])[];
  readonly onInputShortage: "throttle" | "block";
}
