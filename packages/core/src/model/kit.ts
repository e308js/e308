import { type CalendarOptions, createCalendar } from "../calendar/builders.js";
import type { CalendarDefinition } from "../calendar/types.js";
import {
  createDomainEventDefinition,
  createRecordDefinition,
  type DomainEventOptions,
  type RecordOptions,
} from "../domain/builders.js";
import type { DomainEventDefinition, JsonValue, RecordDefinition } from "../domain/types.js";
import type { AllocationDefinition } from "../economy/allocations.js";
import type { BuyableDefinition } from "../economy/buyables.js";
import type { PurchaseCurve } from "../economy/curves.js";
import { createRateBuilders, type RateBuilders } from "../economy/rates.js";
import type { RecipeDefinition } from "../economy/recipes.js";
import type { FlowDefinition, Rate } from "../economy/types.js";
import { createMarket, type MarketOptions } from "../markets/builders.js";
import type { MarketDefinition } from "../markets/types.js";
import type { NumericAdapter } from "../numbers/types.js";
import type { ScopeActivationDefinition } from "../progression/activation.js";
import type { SteppedRuleDefinition } from "../simulation/rules.js";
import { createTask, type TaskOptions } from "../tasks/builders.js";
import type { TaskDefinition } from "../tasks/types.js";
import { defineOwnedGame, type GameContentInput } from "./definition.js";
import type { Resource, Scope } from "./handles.js";
import { owned } from "./handles.js";
import {
  type AutomationDefinition,
  type AutomationOptions,
  type ChallengeDefinition,
  type ChallengeOptions,
  createAutomation,
  createChallenge,
  createPrestige,
  createTrigger,
  createUpgrade,
  type PrestigeDefinition,
  type PrestigeOptions,
  type TriggerDefinition,
  type TriggerOptions,
  type UpgradeDefinition,
  type UpgradeOptions,
} from "./progression-builders.js";
import { assertOwner, freezeEntries, safePriority, validId } from "./validation.js";

interface ResourceOptions<N> {
  readonly scope: Scope;
  readonly initial: N;
  readonly capacity?: N;
  readonly capacityFor?: (get: (resource: Resource<N>) => N) => N;
  readonly overflow?: "block" | "clamp" | "discard";
}

interface FlowOptions<N> {
  readonly scope: Scope;
  readonly priority?: number;
  readonly rate: Rate<N>;
  readonly consumes?: readonly (readonly [Resource<N>, N])[];
  readonly produces: readonly (readonly [Resource<N>, N])[];
  readonly onInputShortage?: "throttle" | "block";
}

interface BuyableOptions<N> {
  readonly scope: Scope;
  readonly currency: Resource<N>;
  readonly curve: PurchaseCurve<N>;
  readonly initialCount?: N;
  readonly refundRate?: N;
}

interface RecipeOptions<N> {
  readonly scope: Scope;
  readonly consumes?: readonly (readonly [Resource<N>, N])[];
  readonly produces: readonly (readonly [Resource<N>, N])[];
}

interface AllocationOptions<N> {
  readonly scope: Scope;
  readonly budget: Resource<N>;
  readonly targets: readonly string[];
  readonly initial?: Readonly<Record<string, N>>;
}

export interface GameKit<N> {
  readonly numbers: NumericAdapter<N>;
  readonly rates: RateBuilders<N>;
  q(encoded: string | number): N;
  scope(id: string): Scope;
  resource(id: string, options: ResourceOptions<N>): Resource<N>;
  flow(id: string, options: FlowOptions<N>): FlowDefinition<N>;
  buyable(id: string, options: BuyableOptions<N>): BuyableDefinition<N>;
  recipe(id: string, options: RecipeOptions<N>): RecipeDefinition<N>;
  allocation(id: string, options: AllocationOptions<N>): AllocationDefinition<N>;
  prestige(id: string, options: PrestigeOptions<N>): PrestigeDefinition<N>;
  upgrade(id: string, options: UpgradeOptions<N>): UpgradeDefinition<N>;
  milestone(id: string, options: Omit<TriggerOptions<N>, "kind">): TriggerDefinition<N>;
  achievement(id: string, options: Omit<TriggerOptions<N>, "kind">): TriggerDefinition<N>;
  challenge(id: string, options: ChallengeOptions<N>): ChallengeDefinition<N>;
  automation(id: string, options: AutomationOptions<N>): AutomationDefinition<N>;
  task(id: string, options: TaskOptions<N>): TaskDefinition<N>;
  calendar(id: string, options: CalendarOptions): CalendarDefinition;
  market(id: string, options: MarketOptions<N>): MarketDefinition<N>;
  record<T extends JsonValue>(id: string, options: RecordOptions<T>): RecordDefinition<T>;
  eventType<P extends JsonValue>(
    id: string,
    options: DomainEventOptions<P>,
  ): DomainEventDefinition<P>;
  scopeActivation(
    id: string,
    options: Omit<ScopeActivationDefinition<N>, "id">,
  ): ScopeActivationDefinition<N>;
  steppedRule(
    id: string,
    options: Omit<SteppedRuleDefinition<N>, "id" | "priority"> & { readonly priority?: number },
  ): SteppedRuleDefinition<N>;
  defineGame(options: GameContentInput<N>): import("./definition.js").GameDefinition<N>;
}

export function createGameKit<N>(options: { readonly numbers: NumericAdapter<N> }): GameKit<N> {
  const owner = Object.freeze({});
  const numbers = options.numbers;
  const kit: GameKit<N> = {
    numbers,
    rates: createRateBuilders(owner, numbers),
    q: (encoded: string | number) =>
      typeof encoded === "number" ? numbers.fromNumber(encoded) : numbers.fromString(encoded),
    scope: (id: string) => createScope(id, owner),
    resource: (id: string, value: ResourceOptions<N>) => createResource(id, value, owner, numbers),
    flow: (id: string, value: FlowOptions<N>) => createFlow(id, value, owner, numbers),
    buyable: (id: string, value: BuyableOptions<N>) => createBuyable(id, value, owner, numbers),
    recipe: (id: string, value: RecipeOptions<N>) => createRecipe(id, value, owner, numbers),
    allocation: (id: string, value: AllocationOptions<N>) =>
      createAllocation(id, value, owner, numbers),
    prestige: (id: string, value: PrestigeOptions<N>) => createPrestige(id, value, owner),
    upgrade: (id, value) => createUpgrade(id, value, owner, numbers),
    milestone: (id, value) => createTrigger(id, { ...value, kind: "milestone" }, owner),
    achievement: (id, value) => createTrigger(id, { ...value, kind: "achievement" }, owner),
    challenge: (id, value) => createChallenge(id, value, owner),
    automation: (id, value) => createAutomation(id, value, owner),
    task: (id, value) => createTask(id, value, owner, numbers),
    calendar: (id, value) => createCalendar(id, value, owner),
    market: (id, value) => createMarket(id, value, owner, numbers),
    record: (id, value) => createRecordDefinition(id, value, owner),
    eventType: (id, value) => createDomainEventDefinition(id, value, owner),
    scopeActivation: (id, value) => {
      validId(id, "scope activation");
      assertOwner(value.scope, owner, `Scope for ${id}`);
      return owned({ ...value, id }, owner);
    },
    steppedRule: (id, value) => {
      validId(id, "stepped rule");
      assertOwner(value.scope, owner, `Scope for ${id}`);
      return owned({ ...value, id, priority: safePriority(value.priority, id) }, owner);
    },
    defineGame: (input) => defineOwnedGame({ ...input, numbers }, owner),
  };
  return Object.freeze(kit);
}

function createScope(id: string, owner: object): Scope {
  validId(id, "scope");
  return owned({ id } as Scope, owner);
}

function createResource<N>(
  id: string,
  options: ResourceOptions<N>,
  owner: object,
  numbers: NumericAdapter<N>,
): Resource<N> {
  validId(id, "resource");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  if (!numbers.isFinite(options.initial))
    throw new TypeError(`Initial value for ${id} must be finite`);
  if (options.capacity !== undefined && !numbers.isFinite(options.capacity)) {
    throw new TypeError(`Capacity for ${id} must be finite`);
  }
  if (
    options.capacity !== undefined &&
    (numbers.cmp(options.capacity, numbers.fromNumber(0)) < 0 ||
      numbers.cmp(options.initial, options.capacity) > 0)
  ) {
    throw new TypeError(`Capacity for ${id} must be nonnegative and at least its initial value`);
  }
  return owned(
    {
      id,
      scope: options.scope,
      initial: options.initial,
      ...(options.capacity === undefined ? {} : { capacity: options.capacity }),
      ...(options.capacityFor === undefined ? {} : { capacityFor: options.capacityFor }),
      overflow: options.overflow ?? "block",
    } as Resource<N>,
    owner,
  );
}

function createFlow<N>(
  id: string,
  options: FlowOptions<N>,
  owner: object,
  numbers: NumericAdapter<N>,
): FlowDefinition<N> {
  validId(id, "flow");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  const priority = safePriority(options.priority, id);
  const consumes = freezeEntries(options.consumes ?? [], owner, numbers, id);
  const produces = freezeEntries(options.produces, owner, numbers, id);
  if (produces.length === 0) throw new TypeError(`Flow ${id} must produce at least one resource`);
  return owned(
    {
      id,
      scope: options.scope,
      priority,
      rate: options.rate,
      consumes,
      produces,
      onInputShortage: options.onInputShortage ?? "throttle",
    } as FlowDefinition<N>,
    owner,
  );
}

function createBuyable<N>(
  id: string,
  options: BuyableOptions<N>,
  owner: object,
  numbers: NumericAdapter<N>,
): BuyableDefinition<N> {
  validId(id, "buyable");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  assertOwner(options.currency, owner, `Currency for ${id}`);
  if (options.curve.numericAdapterId !== numbers.id)
    throw new TypeError(`Curve for ${id} uses another numeric adapter`);
  const initialCount = options.initialCount ?? numbers.fromNumber(0);
  const refundRate = options.refundRate ?? numbers.fromNumber(1);
  const zero = numbers.fromNumber(0);
  if (
    !numbers.isFinite(initialCount) ||
    numbers.cmp(initialCount, zero) < 0 ||
    numbers.cmp(numbers.floor(initialCount), initialCount) !== 0
  ) {
    throw new TypeError(`Initial count for ${id} must be a nonnegative integer quantity`);
  }
  if (
    !numbers.isFinite(refundRate) ||
    numbers.cmp(refundRate, zero) < 0 ||
    numbers.cmp(refundRate, numbers.fromNumber(1)) > 0
  ) {
    throw new TypeError(`Refund rate for ${id} must be between zero and one`);
  }
  return owned(
    {
      id,
      scope: options.scope,
      currency: options.currency,
      curve: options.curve,
      initialCount,
      refundRate,
    } as BuyableDefinition<N>,
    owner,
  );
}

function createRecipe<N>(
  id: string,
  options: RecipeOptions<N>,
  owner: object,
  numbers: NumericAdapter<N>,
): RecipeDefinition<N> {
  validId(id, "recipe");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  const consumes = freezeEntries(options.consumes ?? [], owner, numbers, id);
  const produces = freezeEntries(options.produces, owner, numbers, id);
  if (produces.length === 0) throw new TypeError(`Recipe ${id} must produce at least one resource`);
  return owned({ id, scope: options.scope, consumes, produces } as RecipeDefinition<N>, owner);
}

function createAllocation<N>(
  id: string,
  options: AllocationOptions<N>,
  owner: object,
  numbers: NumericAdapter<N>,
): AllocationDefinition<N> {
  validId(id, "allocation");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  assertOwner(options.budget, owner, `Budget for ${id}`);
  const targets = Object.freeze([...options.targets]);
  if (targets.length === 0 || new Set(targets).size !== targets.length) {
    throw new TypeError(`Allocation ${id} requires unique targets`);
  }
  const initial: Record<string, N> = {};
  let assigned = numbers.fromNumber(0);
  for (const target of targets) {
    validId(target, "allocation target");
    const amount = options.initial?.[target] ?? numbers.fromNumber(0);
    if (!numbers.isFinite(amount) || numbers.cmp(amount, numbers.fromNumber(0)) < 0) {
      throw new TypeError(`Initial allocation for ${id}:${target} must be nonnegative and finite`);
    }
    initial[target] = amount;
    assigned = numbers.add(assigned, amount);
  }
  if (Object.keys(options.initial ?? {}).some((target) => !targets.includes(target))) {
    throw new TypeError(`Allocation ${id} has an unknown initial target`);
  }
  if (numbers.cmp(assigned, options.budget.initial) > 0) {
    throw new TypeError(`Initial allocation for ${id} exceeds its initial budget`);
  }
  return owned(
    { id, scope: options.scope, budget: options.budget, targets, initial: Object.freeze(initial) },
    owner,
  );
}
