import type { CalendarState } from "../calendar/types.js";
import { resolveCapacity } from "../economy/entries.js";
import type { MarketState } from "../markets/types.js";
import type { GameDefinition } from "../model/definition.js";
import type { Resource } from "../model/handles.js";
import { ownerOf } from "../model/handles.js";
import { NumericFault } from "../numbers/types.js";
import { progressionContext } from "../progression/context.js";
import type { RandomStreams } from "../random/xoshiro.js";
import type { TaskState } from "../tasks/types.js";
import type { MutableProgression } from "./progression-state.js";
import { applyReset, ResetTargetError } from "./reset.js";
import type {
  CommandFailure,
  ProgressionEvent,
  ProgressionFlagKind,
  Transaction,
} from "./types.js";

export function makeTransaction<N>(
  owner: object,
  working: Record<string, N>,
  purchaseCounts: Record<string, N>,
  allocations: Record<string, Record<string, N>>,
  productionTotals: Record<string, N>,
  scopeGenerations: Record<string, bigint>,
  definition: GameDefinition<N>,
  progression: MutableProgression<N>,
  random: RandomStreams,
  tasks: Record<string, TaskState<N>>,
  calendars: Record<string, CalendarState>,
  markets: Record<string, MarketState<N>>,
  gameTimeMs: number,
  numbers: NonNullable<GameDefinition<N>["numbers"]>,
): Transaction<N> {
  const clock = { value: gameTimeMs };
  const transaction = {} as Transaction<N>;
  Object.assign(transaction, {
    numbers,
    gameTimeMs: () => clock.value,
    random: (path) => random.open(path),
    isScopeActive: (scope) => {
      if (ownerOf(scope) !== owner) throw new InvalidTarget(scope.id);
      return (definition.scopeActivations ?? [])
        .filter((activation) => activation.scope.id === scope.id)
        .every((activation) => activation.active(progressionContext(transaction)));
    },
    ...resourceMethods(owner, working, numbers),
    getPurchase: (id) => purchaseCounts[id] ?? numbers.fromNumber(0),
    setPurchase: (id, value) => {
      if (!numbers.isFinite(value)) throw new NumericFault(`Invalid purchase count for ${id}`);
      purchaseCounts[id] = value;
    },
    getAllocation: (id, targetId) => allocations[id]?.[targetId] ?? numbers.fromNumber(0),
    setAllocation: (id, targetId, value) => {
      if (!numbers.isFinite(value))
        throw new NumericFault(`Invalid allocation for ${id}:${targetId}`);
      const allocation = allocations[id];
      if (!allocation || !(targetId in allocation)) throw new InvalidTarget(`${id}:${targetId}`);
      allocation[targetId] = value;
    },
    addProduction: (id, executions) => {
      if (!numbers.isFinite(executions))
        throw new NumericFault(`Invalid production total for ${id}`);
      productionTotals[id] = numbers.add(productionTotals[id] ?? numbers.fromNumber(0), executions);
    },
    reset: (manifest) =>
      applyReset(
        manifest,
        owner,
        working,
        purchaseCounts,
        allocations,
        scopeGenerations,
        definition,
        progression,
        tasks,
        calendars,
        markets,
        clock.value,
      ),
    ...progressionMethods(progression, numbers, () => clock.value),
    ...timedMethods(owner, tasks, calendars, markets),
    reject: (error) => {
      throw new OperationRejected(error);
    },
  } satisfies Transaction<N>);
  transactionClocks.set(transaction, clock);
  return transaction;
}

function resourceMethods<N>(
  owner: object,
  working: Record<string, N>,
  numbers: NonNullable<GameDefinition<N>["numbers"]>,
): Pick<Transaction<N>, "get" | "set" | "add"> {
  const assertResource = (resource: Resource<N>): void => {
    if (ownerOf(resource) !== owner || !(resource.id in working))
      throw new InvalidTarget(resource.id);
  };
  const get = (resource: Resource<N>): N => {
    assertResource(resource);
    return working[resource.id] as N;
  };
  const set = (resource: Resource<N>, initialValue: N): void => {
    assertResource(resource);
    if (!numbers.isFinite(initialValue)) throw new NumericFault(`Invalid value for ${resource.id}`);
    const capacity = resolveCapacity(resource, get, numbers);
    let value = initialValue;
    if (capacity !== undefined && numbers.cmp(value, capacity) > 0) {
      if (resource.overflow === "block")
        throw new OperationRejected({
          code: "capacity-blocked",
          resourceId: resource.id,
          attempted: value,
          capacity,
        });
      value = capacity;
    }
    working[resource.id] = value;
  };
  return { get, set, add: (resource, amount) => set(resource, numbers.add(get(resource), amount)) };
}

function timedMethods<N>(
  owner: object,
  tasks: Record<string, TaskState<N>>,
  calendars: Record<string, CalendarState>,
  markets: Record<string, MarketState<N>>,
): Pick<
  Transaction<N>,
  | "getTaskState"
  | "setTaskState"
  | "getCalendarState"
  | "setCalendarState"
  | "getMarketState"
  | "setMarketState"
> {
  return {
    getTaskState: (id) => requiredState(tasks, id, "task"),
    setTaskState: (id, state) => {
      requiredState(tasks, id, "task");
      tasks[id] = state;
    },
    getCalendarState: (calendar) => {
      if (ownerOf(calendar) !== owner) throw new InvalidTarget(calendar.id);
      return requiredState(calendars, calendar.id, "calendar");
    },
    setCalendarState: (calendar, state) => {
      if (ownerOf(calendar) !== owner) throw new InvalidTarget(calendar.id);
      requiredState(calendars, calendar.id, "calendar");
      calendars[calendar.id] = state;
    },
    getMarketState: (id) => requiredState(markets, id, "market"),
    setMarketState: (id, state) => {
      requiredState(markets, id, "market");
      markets[id] = state;
    },
  };
}

function requiredState<T>(states: Record<string, T>, id: string, kind: string): T {
  const state = states[id];
  if (!state) throw new InvalidTarget(`${kind}:${id}`);
  return state;
}

const transactionClocks = new WeakMap<object, { value: number }>();

export function setTransactionTime<N>(transaction: Transaction<N>, gameTimeMs: number): void {
  const clock = transactionClocks.get(transaction);
  if (!clock) throw new TypeError("Transaction clock is unavailable");
  clock.value = gameTimeMs;
}

function progressionMethods<N>(
  progression: MutableProgression<N>,
  numbers: NonNullable<GameDefinition<N>["numbers"]>,
  gameTimeMs: () => number,
): Pick<
  Transaction<N>,
  | "hasProgress"
  | "setProgress"
  | "hasActiveChallenges"
  | "isChallengeActive"
  | "setChallengeActive"
  | "getChallengeCompletions"
  | "setChallengeCompletions"
  | "hasReward"
  | "addReward"
  | "getAutomation"
  | "setAutomation"
  | "setWon"
> {
  return {
    hasProgress: (kind, id) => Object.hasOwn(progressFlags(progression, kind), id),
    setProgress: (kind, id) => {
      if (Object.hasOwn(progressFlags(progression, kind), id)) return;
      progressFlags(progression, kind)[id] = true;
      recordProgressionEvent(progression, kind, id, gameTimeMs());
    },
    hasActiveChallenges: () => progression.activeChallenges.size > 0,
    isChallengeActive: (id) => progression.activeChallenges.has(id),
    setChallengeActive: (id, active) => {
      if (active) progression.activeChallenges.add(id);
      else progression.activeChallenges.delete(id);
    },
    getChallengeCompletions: (id) => progression.challengeCompletions[id] ?? numbers.fromNumber(0),
    setChallengeCompletions: (id, value) => {
      if (!numbers.isFinite(value)) throw new NumericFault(`Invalid challenge count for ${id}`);
      progression.challengeCompletions[id] = value;
    },
    hasReward: (id) => progression.rewardLedger.has(id),
    addReward: (id) => {
      if (progression.rewardLedger.has(id)) return;
      progression.rewardLedger.add(id);
      recordProgressionEvent(progression, "challenge-reward", id, gameTimeMs());
    },
    getAutomation: (id) => progression.automation[id],
    setAutomation: (id, state) => {
      if (!Number.isSafeInteger(state.nextRunMs) || state.nextRunMs < 0)
        throw new TypeError(`Invalid automation schedule for ${id}`);
      progression.automation[id] = Object.freeze({ ...state });
    },
    setWon: (value) => {
      if (value && !progression.won)
        recordProgressionEvent(progression, "win", "game", gameTimeMs());
      progression.won = value;
    },
  };
}

function recordProgressionEvent<N>(
  progression: MutableProgression<N>,
  kind: ProgressionEvent["kind"],
  id: string,
  atGameMs: number,
): void {
  const sequence = (progression.events.at(-1)?.sequence ?? 0n) + 1n;
  progression.events.push(Object.freeze({ sequence, kind, id, atGameMs }));
}

function progressFlags<N>(
  progression: MutableProgression<N>,
  kind: ProgressionFlagKind,
): Record<string, true> {
  if (kind === "upgrade") return progression.upgrades;
  if (kind === "milestone") return progression.milestones;
  return progression.achievements;
}

class InvalidTarget extends Error {
  constructor(readonly id: string) {
    super(`Invalid target: ${id}`);
  }
}

class OperationRejected<N> extends Error {
  constructor(readonly failure: CommandFailure<N>) {
    super(failure.code);
  }
}

export function failureFrom<N>(error: unknown): CommandFailure<N> {
  if (error instanceof OperationRejected) return error.failure as CommandFailure<N>;
  if (error instanceof InvalidTarget) return { code: "invalid-target", id: error.id };
  if (error instanceof ResetTargetError) return { code: "invalid-target", id: error.id };
  if (error instanceof NumericFault) return { code: "numeric-fault", message: error.message };
  return {
    code: "transaction-failed",
    message: error instanceof Error ? error.message : String(error),
  };
}
