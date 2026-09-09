import type { CalendarState } from "../calendar/types.js";
import type { MarketState } from "../markets/types.js";
import type { GameDefinition } from "../model/definition.js";
import type { TaskState } from "../tasks/types.js";

export function initialTasks<N>(definition: GameDefinition<N>): Record<string, TaskState<N>> {
  return Object.fromEntries(
    (definition.tasks ?? []).map((task) => [task.id, initialTaskState<N>()]),
  );
}

export function initialTaskState<N>(): TaskState<N> {
  return { nextSequence: 0n, queue: [], active: null, completed: [], refunds: [] };
}

export function initialCalendars<N>(definition: GameDefinition<N>): Record<string, CalendarState> {
  return Object.fromEntries(
    (definition.calendars ?? []).map((calendar) => [
      calendar.id,
      { phaseIndex: 0, elapsedMs: 0, cycle: 0n, boundaries: [] },
    ]),
  );
}

export function initialMarkets<N>(definition: GameDefinition<N>): Record<string, MarketState<N>> {
  const zero = definition.numbers?.fromNumber(0);
  if (zero === undefined) throw new TypeError("Game definition has no numeric adapter");
  return Object.fromEntries(
    (definition.markets ?? []).map((market) => [market.id, { bought: zero, sold: zero }]),
  );
}

export function cloneTasks<N>(
  source: Readonly<Record<string, TaskState<N>>>,
): Record<string, TaskState<N>> {
  return Object.fromEntries(
    Object.entries(source).map(([id, state]) => [
      id,
      {
        ...state,
        queue: state.queue.map((entry) => ({
          ...entry,
          escrow: { ...entry.escrow },
          outputs: { ...entry.outputs },
        })),
        active: state.active
          ? {
              ...state.active,
              escrow: { ...state.active.escrow },
              outputs: { ...state.active.outputs },
            }
          : null,
        completed: state.completed.map((claim) => ({
          ...claim,
          quantities: { ...claim.quantities },
        })),
        refunds: state.refunds.map((claim) => ({ ...claim, quantities: { ...claim.quantities } })),
      },
    ]),
  );
}

export function freezeTasks<N>(
  source: Record<string, TaskState<N>>,
): Readonly<Record<string, TaskState<N>>> {
  return Object.freeze(
    Object.fromEntries(Object.entries(source).map(([id, state]) => [id, freezeTask(state)])),
  );
}

function freezeTask<N>(state: TaskState<N>): TaskState<N> {
  const claims = (values: TaskState<N>["completed"]) =>
    Object.freeze(
      values.map((claim) =>
        Object.freeze({ ...claim, quantities: Object.freeze(claim.quantities) }),
      ),
    );
  return Object.freeze({
    ...state,
    queue: Object.freeze(
      state.queue.map((entry) =>
        Object.freeze({
          ...entry,
          escrow: Object.freeze(entry.escrow),
          outputs: Object.freeze(entry.outputs),
        }),
      ),
    ),
    active: state.active
      ? Object.freeze({
          ...state.active,
          escrow: Object.freeze(state.active.escrow),
          outputs: Object.freeze(state.active.outputs),
        })
      : null,
    completed: claims(state.completed),
    refunds: claims(state.refunds),
  });
}

export function cloneCalendars(
  source: Readonly<Record<string, CalendarState>>,
): Record<string, CalendarState> {
  return Object.fromEntries(
    Object.entries(source).map(([id, state]) => [
      id,
      { ...state, boundaries: state.boundaries.map((entry) => ({ ...entry })) },
    ]),
  );
}

export function freezeCalendars(
  source: Record<string, CalendarState>,
): Readonly<Record<string, CalendarState>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(source).map(([id, state]) => [
        id,
        Object.freeze({
          ...state,
          boundaries: Object.freeze(state.boundaries.map((entry) => Object.freeze({ ...entry }))),
        }),
      ]),
    ),
  );
}

export function freezeMarkets<N>(
  source: Record<string, MarketState<N>>,
): Readonly<Record<string, MarketState<N>>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(source).map(([id, state]) => [id, Object.freeze({ ...state })]),
    ),
  );
}
