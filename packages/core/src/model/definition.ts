import type { AutomationDefinition } from "../automation/scheduler.js";
import type { CalendarDefinition } from "../calendar/types.js";
import type { AllocationDefinition } from "../economy/allocations.js";
import type { BuyableDefinition } from "../economy/buyables.js";
import type { RecipeDefinition } from "../economy/recipes.js";
import type { FlowDefinition } from "../economy/types.js";
import type { MarketDefinition } from "../markets/types.js";
import type { NumericAdapter } from "../numbers/types.js";
import type { ScopeActivationDefinition } from "../progression/activation.js";
import type { ChallengeDefinition } from "../progression/challenges.js";
import type { ProgressionContext } from "../progression/context.js";
import type { TriggerDefinition, UpgradeDefinition } from "../progression/features.js";
import type { PrestigeDefinition } from "../progression/resets.js";
import type { SteppedRuleDefinition } from "../simulation/rules.js";
import type { TaskDefinition } from "../tasks/types.js";

declare const gameIdBrand: unique symbol;

import type { Resource, Scope } from "./handles.js";
import { owned, ownerOf } from "./handles.js";

export type GameId = string & { readonly [gameIdBrand]: true };

export interface GameDefinition<N = never> {
  readonly id: GameId;
  readonly simulationVersion: number;
  readonly stepMs: number;
  readonly rootSeed?: string;
  readonly numbers?: NumericAdapter<N>;
  readonly resources?: readonly Resource<N>[];
  readonly flows?: readonly FlowDefinition<N>[];
  readonly buyables?: readonly BuyableDefinition<N>[];
  readonly recipes?: readonly RecipeDefinition<N>[];
  readonly allocations?: readonly AllocationDefinition<N>[];
  readonly prestiges?: readonly PrestigeDefinition<N>[];
  readonly upgrades?: readonly UpgradeDefinition<N>[];
  readonly triggers?: readonly TriggerDefinition<N>[];
  readonly challenges?: readonly ChallengeDefinition<N>[];
  readonly automation?: readonly AutomationDefinition<N>[];
  readonly scopeActivations?: readonly ScopeActivationDefinition<N>[];
  readonly win?: (state: ProgressionContext<N>) => boolean;
  readonly steppedRules?: readonly SteppedRuleDefinition<N>[];
  readonly tasks?: readonly TaskDefinition<N>[];
  readonly calendars?: readonly CalendarDefinition[];
  readonly markets?: readonly MarketDefinition<N>[];
}

export interface GameDefinitionInput {
  readonly id: string;
  readonly simulationVersion: number;
  readonly stepMs: number;
  readonly rootSeed?: string;
}

export interface GameContentInput<N> extends GameDefinitionInput {
  readonly resources: readonly Resource<N>[];
  readonly flows?: readonly FlowDefinition<N>[];
  readonly buyables?: readonly BuyableDefinition<N>[];
  readonly recipes?: readonly RecipeDefinition<N>[];
  readonly allocations?: readonly AllocationDefinition<N>[];
  readonly prestiges?: readonly PrestigeDefinition<N>[];
  readonly upgrades?: readonly UpgradeDefinition<N>[];
  readonly triggers?: readonly TriggerDefinition<N>[];
  readonly challenges?: readonly ChallengeDefinition<N>[];
  readonly automation?: readonly AutomationDefinition<N>[];
  readonly scopeActivations?: readonly ScopeActivationDefinition<N>[];
  readonly win?: (state: ProgressionContext<N>) => boolean;
  readonly steppedRules?: readonly SteppedRuleDefinition<N>[];
  readonly tasks?: readonly TaskDefinition<N>[];
  readonly calendars?: readonly CalendarDefinition[];
  readonly markets?: readonly MarketDefinition<N>[];
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export function defineGame(input: GameDefinitionInput): GameDefinition {
  if (!ID_PATTERN.test(input.id)) {
    throw new TypeError(`Invalid game id: ${input.id}`);
  }
  if (!Number.isSafeInteger(input.simulationVersion) || input.simulationVersion < 1) {
    throw new TypeError("simulationVersion must be a positive safe integer");
  }
  if (!Number.isSafeInteger(input.stepMs) || input.stepMs < 1) {
    throw new TypeError("stepMs must be a positive safe integer");
  }
  return Object.freeze({
    id: input.id as GameId,
    simulationVersion: input.simulationVersion,
    stepMs: input.stepMs,
  });
}

export function defineOwnedGame<N>(
  input: GameContentInput<N> & { readonly numbers: NumericAdapter<N> },
  owner: object,
): GameDefinition<N> {
  const base = defineGame(input);
  const seen = new Set<string>();
  for (const resource of input.resources) {
    if (ownerOf(resource) !== owner)
      throw new TypeError(`Resource ${resource.id} belongs to another game kit`);
    if (seen.has(resource.id)) throw new TypeError(`Duplicate resource id: ${resource.id}`);
    seen.add(resource.id);
  }
  const flowIds = new Set<string>();
  for (const flow of input.flows ?? []) {
    if (ownerOf(flow) !== owner) throw new TypeError(`Flow ${flow.id} belongs to another game kit`);
    if (flowIds.has(flow.id)) throw new TypeError(`Duplicate flow id: ${flow.id}`);
    flowIds.add(flow.id);
  }
  const buyableIds = new Set<string>();
  for (const buyable of input.buyables ?? []) {
    if (ownerOf(buyable) !== owner)
      throw new TypeError(`Buyable ${buyable.id} belongs to another game kit`);
    if (buyableIds.has(buyable.id)) throw new TypeError(`Duplicate buyable id: ${buyable.id}`);
    buyableIds.add(buyable.id);
  }
  validateOwnedIds(input.recipes ?? [], owner, "Recipe");
  validateOwnedIds(input.allocations ?? [], owner, "Allocation");
  validateOwnedIds(input.prestiges ?? [], owner, "Prestige");
  validateOwnedIds(input.upgrades ?? [], owner, "Upgrade");
  validateOwnedIds(input.triggers ?? [], owner, "Trigger");
  validateOwnedIds(input.challenges ?? [], owner, "Challenge");
  validateOwnedIds(input.automation ?? [], owner, "Automation");
  validateOwnedIds(input.scopeActivations ?? [], owner, "Scope activation");
  validateOwnedIds(input.steppedRules ?? [], owner, "Stepped rule");
  validateOwnedIds(input.tasks ?? [], owner, "Task");
  validateOwnedIds(input.calendars ?? [], owner, "Calendar");
  validateOwnedIds(input.markets ?? [], owner, "Market");
  for (const calendar of input.calendars ?? []) {
    if (calendar.phases.some((phase) => phase.durationMs % base.stepMs !== 0))
      throw new TypeError(`Calendar ${calendar.id} phase durations must align to stepMs`);
  }
  return owned(
    {
      id: base.id,
      simulationVersion: base.simulationVersion,
      stepMs: base.stepMs,
      rootSeed: input.rootSeed ?? "00",
      numbers: input.numbers,
      resources: Object.freeze([...input.resources]),
      flows: Object.freeze([...(input.flows ?? [])]),
      buyables: Object.freeze([...(input.buyables ?? [])]),
      recipes: Object.freeze([...(input.recipes ?? [])]),
      allocations: Object.freeze([...(input.allocations ?? [])]),
      prestiges: Object.freeze([...(input.prestiges ?? [])]),
      upgrades: Object.freeze([...(input.upgrades ?? [])]),
      triggers: Object.freeze([...(input.triggers ?? [])]),
      challenges: Object.freeze([...(input.challenges ?? [])]),
      automation: Object.freeze([...(input.automation ?? [])]),
      scopeActivations: Object.freeze([...(input.scopeActivations ?? [])]),
      ...(input.win === undefined ? {} : { win: input.win }),
      steppedRules: Object.freeze([...(input.steppedRules ?? [])]),
      tasks: Object.freeze([...(input.tasks ?? [])]),
      calendars: Object.freeze([...(input.calendars ?? [])]),
      markets: Object.freeze([...(input.markets ?? [])]),
    },
    owner,
  );
}

function validateOwnedIds(
  values: readonly { readonly id: string }[],
  owner: object,
  kind: string,
): void {
  const ids = new Set<string>();
  for (const value of values) {
    if (ownerOf(value) !== owner)
      throw new TypeError(`${kind} ${value.id} belongs to another game kit`);
    if (ids.has(value.id)) throw new TypeError(`Duplicate ${kind.toLowerCase()} id: ${value.id}`);
    ids.add(value.id);
  }
}

export function definitionOwner<N>(definition: GameDefinition<N>): object {
  const owner = ownerOf(definition);
  if (!owner) throw new TypeError("Game definition has no owner");
  return owner;
}

export function definitionScopes<N>(definition: GameDefinition<N>): readonly Scope[] {
  const groups: readonly (readonly { readonly scope: Scope }[])[] = [
    definition.resources ?? [],
    definition.flows ?? [],
    definition.buyables ?? [],
    definition.recipes ?? [],
    definition.allocations ?? [],
    definition.prestiges ?? [],
    definition.upgrades ?? [],
    definition.triggers ?? [],
    definition.challenges ?? [],
    definition.automation ?? [],
    definition.scopeActivations ?? [],
    definition.steppedRules ?? [],
    definition.tasks ?? [],
    definition.calendars ?? [],
    definition.markets ?? [],
  ];
  const scopes = new Map<string, Scope>();
  for (const group of groups) {
    for (const value of group) scopes.set(value.scope.id, value.scope);
  }
  return Object.freeze(
    [...scopes.values()].sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    ),
  );
}
