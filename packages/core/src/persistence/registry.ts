import { definitionScopes, type GameDefinition } from "../model/definition.js";
import type { Scope } from "../model/handles.js";

export interface ScopeRegistry {
  readonly scopes: readonly string[];
  readonly resourceScopes: Readonly<Record<string, string>>;
  readonly buyableScopes: Readonly<Record<string, string>>;
  readonly allocationScopes: Readonly<Record<string, string>>;
  readonly upgradeScopes: Readonly<Record<string, string>>;
  readonly triggerScopes: Readonly<Record<string, string>>;
  readonly challengeScopes: Readonly<Record<string, string>>;
  readonly automationScopes: Readonly<Record<string, string>>;
  readonly taskScopes: Readonly<Record<string, string>>;
  readonly calendarScopes: Readonly<Record<string, string>>;
  readonly marketScopes: Readonly<Record<string, string>>;
}

export function scopeRegistry<N>(definition: GameDefinition<N>): ScopeRegistry {
  const scopes = new Set<string>();
  const collect = <T extends { readonly id: string; readonly scope: Scope }>(
    values: readonly T[],
  ): Readonly<Record<string, string>> =>
    Object.freeze(
      Object.fromEntries(
        values.map((item) => {
          scopes.add(item.scope.id);
          return [item.id, item.scope.id];
        }),
      ),
    );
  if (!definition.resources) throw new TypeError("Persistence requires a game-kit definition");
  const complete = definition as GameDefinition<N> & {
    readonly buyables: readonly { readonly id: string; readonly scope: Scope }[];
    readonly allocations: readonly { readonly id: string; readonly scope: Scope }[];
    readonly upgrades: readonly { readonly id: string; readonly scope: Scope }[];
    readonly triggers: readonly { readonly id: string; readonly scope: Scope }[];
    readonly challenges: readonly { readonly id: string; readonly scope: Scope }[];
    readonly automation: readonly { readonly id: string; readonly scope: Scope }[];
    readonly tasks: readonly { readonly id: string; readonly scope: Scope }[];
    readonly calendars: readonly { readonly id: string; readonly scope: Scope }[];
    readonly markets: readonly { readonly id: string; readonly scope: Scope }[];
  };
  const resourceScopes = collect(complete.resources as readonly { id: string; scope: Scope }[]);
  const buyableScopes = collect(complete.buyables);
  const allocationScopes = collect(complete.allocations);
  const upgradeScopes = collect(complete.upgrades);
  const triggerScopes = collect(complete.triggers);
  const challengeScopes = collect(complete.challenges);
  const automationScopes = collect(complete.automation);
  const taskScopes = collect(complete.tasks);
  const calendarScopes = collect(complete.calendars);
  const marketScopes = collect(complete.markets);
  for (const scope of definitionScopes(definition)) scopes.add(scope.id);
  return {
    scopes: Object.freeze([...scopes].sort()),
    resourceScopes,
    buyableScopes,
    allocationScopes,
    upgradeScopes,
    triggerScopes,
    challengeScopes,
    automationScopes,
    taskScopes,
    calendarScopes,
    marketScopes,
  };
}
