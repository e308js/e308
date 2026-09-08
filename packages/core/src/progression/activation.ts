import type { Scope } from "../model/handles.js";
import type { ProgressionContext } from "./context.js";

export interface ScopeActivationDefinition<N> {
  readonly id: string;
  readonly scope: Scope;
  readonly active: (state: ProgressionContext<N>) => boolean;
}
