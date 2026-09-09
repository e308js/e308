import type { CalendarState } from "../calendar/types.js";
import type { MarketState } from "../markets/types.js";
import type { ActiveTask, TaskClaim, TaskState } from "../tasks/types.js";
import { parseUnsignedInteger } from "./parse.js";
import type { SerializedScopeState, SerializedTaskClaim, SerializedTaskState } from "./types.js";

export interface TimedState<N> {
  readonly tasks: Record<string, TaskState<N>>;
  readonly calendars: Record<string, CalendarState>;
  readonly markets: Record<string, MarketState<N>>;
}

export function deserializeTimedState<N>(
  scopes: Readonly<Record<string, SerializedScopeState>>,
  parse: (value: string) => N,
): TimedState<N> {
  const result = {
    tasks: {} as Record<string, TaskState<N>>,
    calendars: {} as Record<string, CalendarState>,
    markets: {} as Record<string, MarketState<N>>,
  };
  for (const scope of Object.values(scopes)) {
    for (const [id, state] of Object.entries(scope.tasks ?? {}))
      result.tasks[id] = decodeTask(state, parse);
    for (const [id, state] of Object.entries(scope.calendars ?? {})) {
      result.calendars[id] = {
        phaseIndex: state.phaseIndex,
        elapsedMs: state.elapsedMs,
        cycle: parseUnsignedInteger(state.cycle, "calendar cycle"),
        boundaries: state.boundaries.map((boundary) => ({
          ...boundary,
          sequence: parseUnsignedInteger(boundary.sequence, "calendar boundary sequence"),
          cycle: parseUnsignedInteger(boundary.cycle, "calendar boundary cycle"),
        })),
      };
    }
    for (const [id, state] of Object.entries(scope.markets ?? {})) {
      result.markets[id] = { bought: parse(state.bought), sold: parse(state.sold) };
    }
  }
  return result;
}

function decodeTask<N>(state: SerializedTaskState, parse: (value: string) => N): TaskState<N> {
  const quantities = (values: Readonly<Record<string, string>>) =>
    Object.fromEntries(Object.entries(values).map(([id, value]) => [id, parse(value)]));
  const claim = (value: SerializedTaskClaim): TaskClaim<N> => ({
    sequence: parseUnsignedInteger(value.sequence, "task claim sequence"),
    quantities: quantities(value.quantities),
  });
  return {
    nextSequence: parseUnsignedInteger(state.nextSequence, "task sequence"),
    queue: state.queue.map((entry) => ({
      sequence: parseUnsignedInteger(entry.sequence, "queued task sequence"),
      escrow: quantities(entry.escrow),
      outputs: quantities(entry.outputs),
    })),
    active: decodeActive(state.active, quantities),
    completed: state.completed.map(claim),
    refunds: state.refunds.map(claim),
  };
}

function decodeActive<N>(
  active: SerializedTaskState["active"],
  quantities: (values: Readonly<Record<string, string>>) => Record<string, N>,
): ActiveTask<N> | null {
  if (!active) return null;
  const common = {
    sequence: parseUnsignedInteger(active.sequence, "active task sequence"),
    escrow: quantities(active.escrow),
    outputs: quantities(active.outputs),
  };
  return active.mode === "fixed-duration"
    ? { ...common, mode: active.mode, remainingMs: active.remainingMs }
    : { ...common, mode: active.mode, remainingWork: active.remainingWork };
}
