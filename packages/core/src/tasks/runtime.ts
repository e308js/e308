import { resolveCapacity } from "../economy/entries.js";
import type { NumericAdapter } from "../numbers/types.js";
import type { Command, Transaction } from "../state/types.js";
import type { ActiveTask, TaskClaim, TaskDefinition, TaskState } from "./types.js";

export function queueTaskCommand<N>(
  task: TaskDefinition<N>,
  expectedRevision?: bigint,
): Command<N> {
  return {
    id: `task:${task.id}:queue`,
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
    execute: (transaction) => {
      if (!transaction.isScopeActive(task.scope))
        transaction.reject({ code: "disabled", actionId: task.id, reasonKey: "scope-inactive" });
      const state = transaction.getTaskState(task.id);
      const outstanding = state.queue.length + (state.active ? 1 : 0);
      if (outstanding >= task.queueLimit)
        transaction.reject({ code: "budget-exceeded", budgetId: task.id });
      reserveInputs(task, transaction);
      const sequence = state.nextSequence + 1n;
      const queued = {
        sequence,
        escrow: entriesRecord(task.inputs),
        outputs: entriesRecord(task.outputs),
      };
      transaction.setTaskState(
        task.id,
        startNext(task, { ...state, nextSequence: sequence, queue: [...state.queue, queued] }),
      );
    },
  };
}

export function cancelTaskCommand<N>(
  task: TaskDefinition<N>,
  sequence: bigint,
  expectedRevision?: bigint,
): Command<N> {
  return {
    id: `task:${task.id}:cancel`,
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
    execute: (transaction) => {
      const state = transaction.getTaskState(task.id);
      const claim = requiredClaim(
        cancellationClaim(task, state, sequence, transaction.numbers),
        task,
        sequence,
        transaction,
      );
      const active = state.active?.sequence === sequence ? null : state.active;
      const queue = state.queue.filter((entry) => entry.sequence !== sequence);
      transaction.setTaskState(
        task.id,
        startNext(task, { ...state, active, queue, refunds: [...state.refunds, claim] }),
      );
    },
  };
}

export function claimTaskRefundCommand<N>(
  task: TaskDefinition<N>,
  sequence: bigint,
  expectedRevision?: bigint,
): Command<N> {
  return {
    id: `task:${task.id}:refund`,
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
    execute: (transaction) => {
      const state = transaction.getTaskState(task.id);
      const claim = requiredClaim(
        state.refunds.find((entry) => entry.sequence === sequence),
        task,
        sequence,
        transaction,
      );
      for (const [resource] of task.inputs) {
        const refund = claim.quantities[resource.id];
        if (refund !== undefined) transaction.add(resource, refund);
      }
      transaction.setTaskState(task.id, {
        ...state,
        refunds: state.refunds.filter((entry) => entry.sequence !== sequence),
      });
    },
  };
}

export function runTasks<N>(
  transaction: Transaction<N>,
  definitions: readonly TaskDefinition<N>[],
  stepMs: number,
): void {
  for (const task of [...definitions].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!transaction.isScopeActive(task.scope)) continue;
    let state = startNext(task, transaction.getTaskState(task.id));
    if (!state.active) continue;
    const active = progressActive(task, state.active, stepMs, transaction);
    state = { ...state, active };
    if (isFinished(active) && canDeliver(task, transaction)) {
      const delivered = deliver(task, transaction);
      state = startNext(task, {
        ...state,
        active: null,
        completed: [...state.completed, { sequence: active.sequence, quantities: delivered }],
      });
    }
    transaction.setTaskState(task.id, state);
  }
}

function startNext<N>(task: TaskDefinition<N>, state: TaskState<N>): TaskState<N> {
  if (state.active || state.queue.length === 0) return state;
  const [next, ...queue] = state.queue;
  if (!next) return state;
  const active: ActiveTask<N> =
    task.work.kind === "fixed-duration"
      ? { ...next, mode: "fixed-duration", remainingMs: task.work.durationMs }
      : { ...next, mode: "current-rate", remainingWork: task.work.work };
  return { ...state, queue, active };
}

function reserveInputs<N>(task: TaskDefinition<N>, transaction: Transaction<N>): void {
  for (const [resource, required] of task.inputs) {
    const available = transaction.get(resource);
    if (transaction.numbers.cmp(available, required) < 0)
      transaction.reject({ code: "insufficient", resourceId: resource.id, required, available });
  }
  const zero = transaction.numbers.fromNumber(0);
  for (const [resource, amount] of task.inputs)
    transaction.add(resource, transaction.numbers.sub(zero, amount));
}

function progressActive<N>(
  task: TaskDefinition<N>,
  active: ActiveTask<N>,
  stepMs: number,
  transaction: Transaction<N>,
): ActiveTask<N> {
  if (active.mode === "fixed-duration")
    return { ...active, remainingMs: Math.max(0, active.remainingMs - stepMs) };
  const rate = task.work.kind === "current-rate" ? task.work.rate(transaction) : 0;
  if (!Number.isFinite(rate) || rate < 0)
    throw new TypeError(`Task ${task.id} returned an invalid rate`);
  return { ...active, remainingWork: Math.max(0, active.remainingWork - rate * (stepMs / 1000)) };
}

function isFinished<N>(active: ActiveTask<N>): boolean {
  return active.mode === "fixed-duration" ? active.remainingMs === 0 : active.remainingWork === 0;
}

function canDeliver<N>(task: TaskDefinition<N>, transaction: Transaction<N>): boolean {
  if (task.delivery === "discard-overflow") return true;
  return task.outputs.every(([resource, amount]) => {
    const capacity = resolveCapacity(
      resource,
      (entry) => transaction.get(entry),
      transaction.numbers,
    );
    if (capacity === undefined) return true;
    return (
      transaction.numbers.cmp(
        transaction.numbers.add(transaction.get(resource), amount),
        capacity,
      ) <= 0
    );
  });
}

function deliver<N>(task: TaskDefinition<N>, transaction: Transaction<N>): Record<string, N> {
  const delivered: Record<string, N> = {};
  for (const [resource, amount] of task.outputs) {
    const before = transaction.get(resource);
    const desired = transaction.numbers.add(before, amount);
    const capacity = resolveCapacity(
      resource,
      (entry) => transaction.get(entry),
      transaction.numbers,
    );
    const after =
      task.delivery === "discard-overflow" &&
      capacity !== undefined &&
      transaction.numbers.cmp(desired, capacity) > 0
        ? capacity
        : desired;
    transaction.set(resource, after);
    delivered[resource.id] = transaction.numbers.sub(transaction.get(resource), before);
  }
  return delivered;
}

function cancellationClaim<N>(
  task: TaskDefinition<N>,
  state: TaskState<N>,
  sequence: bigint,
  numbers: NumericAdapter<N>,
): TaskClaim<N> | undefined {
  const item =
    state.active?.sequence === sequence
      ? state.active
      : state.queue.find((entry) => entry.sequence === sequence);
  if (!item) return undefined;
  const ratio =
    task.cancellation.refund === "full"
      ? numbers.fromNumber(1)
      : task.cancellation.refund === "none"
        ? numbers.fromNumber(0)
        : task.cancellation.ratio;
  return {
    sequence,
    quantities: Object.fromEntries(
      Object.entries(item.escrow).map(([id, value]) => [id, numbers.mul(value, ratio)]),
    ),
  };
}

function entriesRecord<N>(
  entries: readonly (readonly [{ readonly id: string }, N])[],
): Record<string, N> {
  return Object.fromEntries(entries.map(([resource, amount]) => [resource.id, amount]));
}

function requiredClaim<N>(
  claim: TaskClaim<N> | undefined,
  task: TaskDefinition<N>,
  sequence: bigint,
  transaction: Transaction<N>,
): TaskClaim<N> {
  if (!claim) transaction.reject({ code: "invalid-target", id: `${task.id}:${sequence}` });
  return claim as TaskClaim<N>;
}
