import { resolveCapacity } from "../economy/entries.js";
import { definitionScopes, type GameDefinition } from "../model/definition.js";
import { RandomStreams } from "../random/xoshiro.js";
import { cloneProgression, freezeProgression } from "./progression-state.js";
import {
  cloneCalendars,
  cloneTasks,
  freezeCalendars,
  freezeMarkets,
  freezeTasks,
} from "./timed-state.js";
import type { Snapshot } from "./types.js";
import { validateTimedState } from "./validate-timed.js";

export function restoreSnapshot<N>(
  definition: GameDefinition<N>,
  source: Snapshot<N>,
): Snapshot<N> {
  const numbers = definition.numbers;
  if (!numbers || !definition.resources) throw new TypeError("Game definition is incomplete");
  if (source.revision < 0n) throw new TypeError("Snapshot revision cannot be negative");
  if (!safeDuration(source.gameTimeMs) || !safeDuration(source.remainderMs))
    throw new TypeError("Snapshot clock is invalid");
  if (source.remainderMs >= definition.stepMs)
    throw new TypeError("Snapshot remainder exceeds the simulation quantum");
  exactKeys(
    source.resources,
    definition.resources.map((item) => item.id),
    "resource",
  );
  exactKeys(
    source.purchaseCounts,
    (definition.buyables ?? []).map((item) => item.id),
    "buyable",
  );
  exactKeys(
    source.allocations,
    (definition.allocations ?? []).map((item) => item.id),
    "allocation",
  );
  exactKeys(
    source.productionTotals,
    definition.resources.map((item) => item.id),
    "production total",
  );
  validateQuantities(definition, source);
  validateProgression(definition, source);
  exactKeys(source.tasks, ownedIds(definition.tasks), "task");
  exactKeys(source.calendars, ownedIds(definition.calendars), "calendar");
  exactKeys(source.markets, ownedIds(definition.markets), "market");
  validateTimedState(definition, source);
  const random = new RandomStreams(source.random.rootSeed, source.random.streams).snapshot();
  if (random.rootSeed !== (definition.rootSeed ?? "00"))
    throw new TypeError("Snapshot random seed does not match the game definition");
  return Object.freeze({
    revision: source.revision,
    gameTimeMs: source.gameTimeMs,
    remainderMs: source.remainderMs,
    resources: Object.freeze({ ...source.resources }),
    purchaseCounts: Object.freeze({ ...source.purchaseCounts }),
    allocations: freezeNested(source.allocations),
    productionTotals: Object.freeze({ ...source.productionTotals }),
    scopeGenerations: Object.freeze({ ...source.scopeGenerations }),
    progression: freezeProgression(cloneProgression(source.progression)),
    random,
    tasks: freezeTasks(cloneTasks(source.tasks)),
    calendars: freezeCalendars(cloneCalendars(source.calendars)),
    markets: freezeMarkets(
      Object.fromEntries(Object.entries(source.markets).map(([id, state]) => [id, { ...state }])),
    ),
  });
}

function validateQuantities<N>(definition: GameDefinition<N>, source: Snapshot<N>): void {
  const numbers = definition.numbers as NonNullable<GameDefinition<N>["numbers"]>;
  const zero = numbers.fromNumber(0);
  for (const resource of definition.resources ?? []) {
    const value = source.resources[resource.id] as N;
    if (!numbers.isFinite(value)) throw new TypeError(`Invalid saved resource: ${resource.id}`);
    const capacity = resolveCapacity(resource, (entry) => source.resources[entry.id] as N, numbers);
    if (capacity !== undefined && numbers.cmp(value, capacity) > 0)
      throw new TypeError(`Saved resource exceeds capacity: ${resource.id}`);
    if (!numbers.isFinite(source.productionTotals[resource.id] as N))
      throw new TypeError(`Invalid production total: ${resource.id}`);
  }
  for (const buyable of definition.buyables ?? []) {
    const count = source.purchaseCounts[buyable.id] as N;
    if (
      !numbers.isFinite(count) ||
      numbers.cmp(count, zero) < 0 ||
      numbers.cmp(numbers.floor(count), count) !== 0
    )
      throw new TypeError(`Invalid saved purchase count: ${buyable.id}`);
  }
  for (const allocation of definition.allocations ?? []) {
    const values = source.allocations[allocation.id] as Readonly<Record<string, N>>;
    exactKeys(values, allocation.targets, `allocation target ${allocation.id}`);
    for (const value of Object.values(values)) {
      if (!numbers.isFinite(value) || numbers.cmp(value, zero) < 0)
        throw new TypeError(`Invalid saved allocation: ${allocation.id}`);
    }
  }
}

function validateProgression<N>(definition: GameDefinition<N>, source: Snapshot<N>): void {
  exactKeys(source.progression.upgrades, ownedIds(definition.upgrades), "upgrade flag", true);
  const triggerIds = (kind: "milestone" | "achievement") =>
    (definition.triggers ?? []).filter((item) => item.kind === kind).map((item) => item.id);
  exactKeys(source.progression.milestones, triggerIds("milestone"), "milestone flag", true);
  exactKeys(source.progression.achievements, triggerIds("achievement"), "achievement flag", true);
  knownValues(source.progression.activeChallenges, ownedIds(definition.challenges), "challenge");
  exactKeys(
    source.progression.challengeCompletions,
    ownedIds(definition.challenges),
    "challenge count",
    true,
  );
  exactKeys(source.progression.automation, ownedIds(definition.automation), "automation", true);
  for (const state of Object.values(source.progression.automation)) {
    if (!safeDuration(state.nextRunMs)) throw new TypeError("Invalid automation schedule");
  }
  let previousEvent = 0n;
  for (const event of source.progression.events) {
    if (
      event.sequence <= previousEvent ||
      !["upgrade", "milestone", "achievement", "challenge-reward", "win"].includes(event.kind) ||
      !event.id ||
      !safeDuration(event.atGameMs) ||
      event.atGameMs > source.gameTimeMs
    ) {
      throw new TypeError("Invalid progression event ledger");
    }
    previousEvent = event.sequence;
  }
  knownValues(
    Object.keys(source.scopeGenerations),
    definitionScopes(definition).map((scope) => scope.id),
    "scope generation",
  );
  if (Object.values(source.scopeGenerations).some((value) => value < 0n))
    throw new TypeError("Scope generation cannot be negative");
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  known: readonly string[],
  label: string,
  subset = false,
): void {
  const actual = Object.keys(value);
  knownValues(actual, known, label);
  if (!subset && actual.length !== known.length) throw new TypeError(`Missing saved ${label}`);
}

function knownValues(actual: readonly string[], known: readonly string[], label: string): void {
  const allowed = new Set(known);
  const unknown = actual.find((id) => !allowed.has(id));
  if (unknown) throw new TypeError(`Unknown saved ${label}: ${unknown}`);
}

function ownedIds(values: readonly { readonly id: string }[] | undefined): readonly string[] {
  return (values ?? []).map((item) => item.id);
}

function safeDuration(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function freezeNested<N>(
  values: Readonly<Record<string, Readonly<Record<string, N>>>>,
): Readonly<Record<string, Readonly<Record<string, N>>>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(values).map(([id, entry]) => [id, Object.freeze({ ...entry })]),
    ),
  );
}
