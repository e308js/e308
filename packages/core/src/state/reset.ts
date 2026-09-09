import type { CalendarState } from "../calendar/types.js";
import type { MarketState } from "../markets/types.js";
import type { GameDefinition } from "../model/definition.js";
import { ownerOf } from "../model/handles.js";
import type { ResetManifest } from "../progression/resets.js";
import type { TaskState } from "../tasks/types.js";
import type { MutableProgression } from "./progression-state.js";
import { initialTaskState } from "./timed-state.js";

export function applyReset<N>(
  manifest: ResetManifest<N>,
  owner: object,
  resources: Record<string, N>,
  purchases: Record<string, N>,
  allocations: Record<string, Record<string, N>>,
  generations: Record<string, bigint>,
  definition: GameDefinition<N>,
  progression: MutableProgression<N>,
  tasks: Record<string, TaskState<N>>,
  calendars: Record<string, CalendarState>,
  markets: Record<string, MarketState<N>>,
  gameTimeMs: number,
): void {
  const cleared = new Set(manifest.clear.map((scope) => scope.id));
  for (const scope of manifest.clear) {
    if (ownerOf(scope) !== owner) throw new ResetTargetError(scope.id);
    generations[scope.id] = (generations[scope.id] ?? 0n) + 1n;
  }
  resetEconomy(manifest, cleared, definition, resources, purchases, allocations, owner);
  resetProgression(manifest, cleared, definition, progression, gameTimeMs, owner);
  const retainedTasks = validateRetention(manifest.retain?.tasks ?? [], cleared, owner);
  for (const task of definition.tasks ?? [])
    if (cleared.has(task.scope.id) && !retainedTasks.has(task)) tasks[task.id] = initialTaskState();
  resetTimed(manifest, cleared, definition, calendars, markets, owner);
}

function resetTimed<N>(
  manifest: ResetManifest<N>,
  cleared: ReadonlySet<string>,
  definition: GameDefinition<N>,
  calendars: Record<string, CalendarState>,
  markets: Record<string, MarketState<N>>,
  owner: object,
): void {
  const retainedCalendars = validateRetention(manifest.retain?.calendars ?? [], cleared, owner);
  for (const calendar of definition.calendars ?? [])
    if (cleared.has(calendar.scope.id) && !retainedCalendars.has(calendar))
      calendars[calendar.id] = { phaseIndex: 0, elapsedMs: 0, cycle: 0n, boundaries: [] };
  const retainedMarkets = validateRetention(manifest.retain?.markets ?? [], cleared, owner);
  const zero = definition.numbers?.fromNumber(0);
  if (zero === undefined) throw new TypeError("Game definition has no numeric adapter");
  for (const market of definition.markets ?? [])
    if (cleared.has(market.scope.id) && !retainedMarkets.has(market))
      markets[market.id] = { bought: zero, sold: zero };
}

function resetEconomy<N>(
  manifest: ResetManifest<N>,
  cleared: ReadonlySet<string>,
  definition: GameDefinition<N>,
  resources: Record<string, N>,
  purchases: Record<string, N>,
  allocations: Record<string, Record<string, N>>,
  owner: object,
): void {
  const retainedResources = validateRetention(manifest.retain?.resources ?? [], cleared, owner);
  const retainedBuyables = validateRetention(manifest.retain?.buyables ?? [], cleared, owner);
  const retainedAllocations = validateRetention(manifest.retain?.allocations ?? [], cleared, owner);
  for (const resource of definition.resources ?? [])
    if (cleared.has(resource.scope.id) && !retainedResources.has(resource))
      resources[resource.id] = resource.initial;
  for (const buyable of definition.buyables ?? [])
    if (cleared.has(buyable.scope.id) && !retainedBuyables.has(buyable))
      purchases[buyable.id] = buyable.initialCount;
  for (const allocation of definition.allocations ?? [])
    if (cleared.has(allocation.scope.id) && !retainedAllocations.has(allocation))
      allocations[allocation.id] = { ...allocation.initial };
}

function resetProgression<N>(
  manifest: ResetManifest<N>,
  cleared: ReadonlySet<string>,
  definition: GameDefinition<N>,
  progression: MutableProgression<N>,
  gameTimeMs: number,
  owner: object,
): void {
  const upgrades = validateRetention(manifest.retain?.upgrades ?? [], cleared, owner);
  const triggers = validateRetention(manifest.retain?.triggers ?? [], cleared, owner);
  const challenges = validateRetention(manifest.retain?.challenges ?? [], cleared, owner);
  const automation = validateRetention(manifest.retain?.automation ?? [], cleared, owner);
  for (const item of definition.upgrades ?? [])
    if (cleared.has(item.scope.id) && !upgrades.has(item)) delete progression.upgrades[item.id];
  for (const item of definition.triggers ?? [])
    if (cleared.has(item.scope.id) && !triggers.has(item))
      delete progression[`${item.kind}s`][item.id];
  for (const item of definition.challenges ?? []) {
    if (!cleared.has(item.scope.id) || challenges.has(item)) continue;
    progression.activeChallenges.delete(item.id);
    delete progression.challengeCompletions[item.id];
  }
  for (const item of definition.automation ?? []) {
    if (!cleared.has(item.scope.id) || automation.has(item)) continue;
    progression.automation[item.id] = {
      enabled: item.initiallyEnabled,
      nextRunMs: gameTimeMs + item.cadenceMs,
    };
  }
}

function validateRetention<T extends { readonly scope: { readonly id: string } }>(
  values: readonly T[],
  cleared: ReadonlySet<string>,
  owner: object,
): ReadonlySet<T> {
  for (const value of values) {
    if (ownerOf(value) !== owner) throw new ResetTargetError(value.scope.id);
    if (!cleared.has(value.scope.id))
      throw new TypeError(`Cannot retain ${value.scope.id} because its scope is not cleared`);
  }
  return new Set(values);
}

export class ResetTargetError extends Error {
  constructor(readonly id: string) {
    super(`Invalid target: ${id}`);
  }
}
