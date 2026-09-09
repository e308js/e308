import type { CalendarDefinition, CalendarState } from "../calendar/types.js";
import type { GameDefinition } from "../model/definition.js";
import type { NumericAdapter } from "../numbers/types.js";
import type { TaskDefinition, TaskState } from "../tasks/types.js";
import type { Snapshot } from "./types.js";

export function validateTimedState<N>(definition: GameDefinition<N>, source: Snapshot<N>): void {
  const numbers = definition.numbers as NumericAdapter<N>;
  for (const task of definition.tasks ?? [])
    validateTask(task, source.tasks[task.id] as TaskState<N>, numbers);
  for (const calendar of definition.calendars ?? [])
    validateCalendar(calendar, source.calendars[calendar.id] as CalendarState, source.gameTimeMs);
  for (const market of definition.markets ?? []) {
    const state = source.markets[market.id];
    if (!state) throw new TypeError(`Missing saved market: ${market.id}`);
    quantity(state.bought, `market bought ${market.id}`, numbers);
    quantity(state.sold, `market sold ${market.id}`, numbers);
  }
}

function validateTask<N>(
  task: TaskDefinition<N>,
  state: TaskState<N>,
  numbers: NumericAdapter<N>,
): void {
  if (!state || state.nextSequence < 0n) throw new TypeError(`Invalid saved task: ${task.id}`);
  const sequences = [
    ...state.queue.map((item) => item.sequence),
    ...(state.active ? [state.active.sequence] : []),
    ...state.completed.map((item) => item.sequence),
    ...state.refunds.map((item) => item.sequence),
  ];
  if (sequences.some((value) => value < 1n || value > state.nextSequence))
    throw new TypeError(`Invalid task sequence: ${task.id}`);
  if (new Set(sequences).size !== sequences.length)
    throw new TypeError(`Duplicate task sequence: ${task.id}`);
  if (state.queue.length + (state.active ? 1 : 0) > task.queueLimit)
    throw new TypeError(`Saved task exceeds queue limit: ${task.id}`);
  for (const entry of state.queue) validateWorkValues(task, entry, numbers);
  if (state.active) {
    if (state.active.mode !== task.work.kind)
      throw new TypeError(`Invalid active task mode: ${task.id}`);
    validateWorkValues(task, state.active, numbers);
    if (
      (state.active.mode === "fixed-duration" &&
        (!safeDuration(state.active.remainingMs) ||
          state.active.remainingMs > taskDuration(task))) ||
      (state.active.mode === "current-rate" &&
        (!Number.isFinite(state.active.remainingWork) ||
          state.active.remainingWork < 0 ||
          state.active.remainingWork > taskWork(task)))
    )
      throw new TypeError(`Invalid active task progress: ${task.id}`);
  }
  for (const claim of state.completed)
    quantityMap(claim.quantities, task.outputs, `task completion ${task.id}`, numbers);
  for (const claim of state.refunds)
    quantityMap(claim.quantities, task.inputs, `task refund ${task.id}`, numbers);
}

function validateWorkValues<N>(
  task: TaskDefinition<N>,
  entry: {
    readonly escrow: Readonly<Record<string, N>>;
    readonly outputs: Readonly<Record<string, N>>;
  },
  numbers: NumericAdapter<N>,
): void {
  quantityMap(entry.escrow, task.inputs, `task escrow ${task.id}`, numbers);
  quantityMap(entry.outputs, task.outputs, `task output ${task.id}`, numbers);
}

function quantityMap<N>(
  values: Readonly<Record<string, N>>,
  entries: readonly (readonly [{ readonly id: string }, N])[],
  label: string,
  numbers: NumericAdapter<N>,
): void {
  const expected = entries.map(([resource]) => resource.id).sort();
  const actual = Object.keys(values).sort();
  if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index]))
    throw new TypeError(`Invalid ${label} inventory`);
  for (const value of Object.values(values)) quantity(value, label, numbers);
}

function quantity<N>(value: N, label: string, numbers: NumericAdapter<N>): void {
  if (!numbers.isFinite(value) || numbers.cmp(value, numbers.fromNumber(0)) < 0)
    throw new TypeError(`Invalid saved ${label}`);
}

function taskDuration<N>(task: TaskDefinition<N>): number {
  return task.work.kind === "fixed-duration" ? task.work.durationMs : 0;
}

function taskWork<N>(task: TaskDefinition<N>): number {
  return task.work.kind === "current-rate" ? task.work.work : 0;
}

function validateCalendar(
  calendar: CalendarDefinition,
  state: CalendarState,
  gameTimeMs: number,
): void {
  const phase = calendar.phases[state?.phaseIndex ?? -1];
  if (!state || !phase || !safeDuration(state.elapsedMs) || state.elapsedMs >= phase.durationMs)
    throw new TypeError(`Invalid saved calendar: ${calendar.id}`);
  if (state.cycle < 0n) throw new TypeError(`Invalid calendar cycle: ${calendar.id}`);
  let sequence = 0n;
  let atGameMs = -1;
  const phaseIds = new Set(calendar.phases.map((item) => item.id));
  for (const boundary of state.boundaries) {
    if (
      boundary.sequence !== sequence + 1n ||
      boundary.cycle < 0n ||
      !phaseIds.has(boundary.phaseId) ||
      !safeDuration(boundary.atGameMs) ||
      boundary.atGameMs <= atGameMs ||
      boundary.atGameMs > gameTimeMs
    )
      throw new TypeError(`Invalid calendar boundary: ${calendar.id}`);
    sequence = boundary.sequence;
    atGameMs = boundary.atGameMs;
  }
}

function safeDuration(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
