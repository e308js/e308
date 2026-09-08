import type { GameDefinition } from "../model/definition.js";
import type { Resource } from "../model/handles.js";
import { ownerOf } from "../model/handles.js";
import { NumericFault } from "../numbers/types.js";
import { progressionContext } from "../progression/context.js";
import type { ResetManifest } from "../progression/resets.js";
import type { MutableProgression } from "./progression-state.js";
import type { CommandFailure, ProgressionFlagKind, Transaction } from "./types.js";

export function makeTransaction<N>(
  owner: object,
  working: Record<string, N>,
  purchaseCounts: Record<string, N>,
  allocations: Record<string, Record<string, N>>,
  productionTotals: Record<string, N>,
  scopeGenerations: Record<string, bigint>,
  definition: GameDefinition<N>,
  progression: MutableProgression<N>,
  gameTimeMs: number,
  numbers: NonNullable<GameDefinition<N>["numbers"]>,
): Transaction<N> {
  const clock = { value: gameTimeMs };
  const assertResource = (resource: Resource<N>): void => {
    if (ownerOf(resource) !== owner || !(resource.id in working)) {
      throw new InvalidTarget(resource.id);
    }
  };
  const transaction = {} as Transaction<N>;
  Object.assign(transaction, {
    numbers,
    gameTimeMs: () => clock.value,
    isScopeActive: (scope) => {
      if (ownerOf(scope) !== owner) throw new InvalidTarget(scope.id);
      return (definition.scopeActivations ?? [])
        .filter((activation) => activation.scope.id === scope.id)
        .every((activation) => activation.active(progressionContext(transaction)));
    },
    get: (resource) => {
      assertResource(resource);
      return working[resource.id] as N;
    },
    set: (resource, value) => {
      assertResource(resource);
      if (!numbers.isFinite(value)) throw new NumericFault(`Invalid value for ${resource.id}`);
      if (resource.capacity !== undefined && numbers.cmp(value, resource.capacity) > 0) {
        if (resource.overflow === "block") {
          throw new OperationRejected({
            code: "capacity-blocked",
            resourceId: resource.id,
            attempted: value,
            capacity: resource.capacity,
          });
        }
        value = resource.capacity;
      }
      working[resource.id] = value;
    },
    add(resource, amount) {
      this.set(resource, numbers.add(this.get(resource), amount));
    },
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
        clock.value,
      ),
    ...progressionMethods(progression, numbers),
    reject: (error) => {
      throw new OperationRejected(error);
    },
  } satisfies Transaction<N>);
  transactionClocks.set(transaction, clock);
  return transaction;
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
): Pick<
  Transaction<N>,
  | "hasProgress"
  | "setProgress"
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
      progressFlags(progression, kind)[id] = true;
    },
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
    addReward: (id) => void progression.rewardLedger.add(id),
    getAutomation: (id) => progression.automation[id],
    setAutomation: (id, state) => {
      if (!Number.isSafeInteger(state.nextRunMs) || state.nextRunMs < 0)
        throw new TypeError(`Invalid automation schedule for ${id}`);
      progression.automation[id] = Object.freeze({ ...state });
    },
    setWon: (value) => {
      progression.won = value;
    },
  };
}

function progressFlags<N>(
  progression: MutableProgression<N>,
  kind: ProgressionFlagKind,
): Record<string, true> {
  if (kind === "upgrade") return progression.upgrades;
  if (kind === "milestone") return progression.milestones;
  return progression.achievements;
}

function applyReset<N>(
  manifest: ResetManifest<N>,
  owner: object,
  resources: Record<string, N>,
  purchases: Record<string, N>,
  allocations: Record<string, Record<string, N>>,
  generations: Record<string, bigint>,
  definition: GameDefinition<N>,
  progression: MutableProgression<N>,
  gameTimeMs: number,
): void {
  const cleared = new Set(manifest.clear.map((scope) => scope.id));
  for (const scope of manifest.clear) {
    if (ownerOf(scope) !== owner) throw new InvalidTarget(scope.id);
    generations[scope.id] = (generations[scope.id] ?? 0n) + 1n;
  }
  const retainedResources = validateRetention(manifest.retain?.resources ?? [], cleared, owner);
  const retainedBuyables = validateRetention(manifest.retain?.buyables ?? [], cleared, owner);
  const retainedAllocations = validateRetention(manifest.retain?.allocations ?? [], cleared, owner);
  for (const resource of definition.resources ?? []) {
    if (cleared.has(resource.scope.id) && !retainedResources.has(resource))
      resources[resource.id] = resource.initial;
  }
  for (const buyable of definition.buyables ?? []) {
    if (cleared.has(buyable.scope.id) && !retainedBuyables.has(buyable))
      purchases[buyable.id] = buyable.initialCount;
  }
  for (const allocation of definition.allocations ?? []) {
    if (cleared.has(allocation.scope.id) && !retainedAllocations.has(allocation))
      allocations[allocation.id] = { ...allocation.initial };
  }
  resetProgression(manifest, cleared, definition, progression, gameTimeMs, owner);
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
  for (const item of definition.triggers ?? []) {
    if (cleared.has(item.scope.id) && !triggers.has(item))
      delete progression[`${item.kind}s`][item.id];
  }
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
    if (ownerOf(value) !== owner) throw new InvalidTarget(value.scope.id);
    if (!cleared.has(value.scope.id))
      throw new TypeError(`Cannot retain ${value.scope.id} because its scope is not cleared`);
  }
  return new Set(values);
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
  if (error instanceof NumericFault) return { code: "numeric-fault", message: error.message };
  return {
    code: "transaction-failed",
    message: error instanceof Error ? error.message : String(error),
  };
}
