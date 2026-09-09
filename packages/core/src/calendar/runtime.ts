import type { Transaction } from "../state/types.js";
import type { CalendarDefinition, CalendarPhase } from "./types.js";

export function currentPhase<N>(
  calendar: CalendarDefinition,
  transaction: Transaction<N>,
): CalendarPhase {
  const phase = calendar.phases[transaction.getCalendarState(calendar).phaseIndex];
  if (!phase) throw new TypeError(`Calendar ${calendar.id} has an invalid phase index`);
  return phase;
}

export function runCalendars<N>(
  transaction: Transaction<N>,
  definitions: readonly CalendarDefinition[],
  stepMs: number,
  boundaryMs: number,
): void {
  const ordered = [...definitions].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  for (const calendar of ordered) {
    if (!transaction.isScopeActive(calendar.scope)) continue;
    const state = transaction.getCalendarState(calendar);
    const phase = calendar.phases[state.phaseIndex] as CalendarPhase;
    const elapsedMs = state.elapsedMs + stepMs;
    if (elapsedMs < phase.durationMs) {
      transaction.setCalendarState(calendar, { ...state, elapsedMs });
      continue;
    }
    const phaseIndex = (state.phaseIndex + 1) % calendar.phases.length;
    const cycle = phaseIndex === 0 ? state.cycle + 1n : state.cycle;
    const nextPhase = calendar.phases[phaseIndex] as CalendarPhase;
    const sequence = (state.boundaries.at(-1)?.sequence ?? 0n) + 1n;
    transaction.setCalendarState(calendar, {
      phaseIndex,
      elapsedMs: elapsedMs - phase.durationMs,
      cycle,
      boundaries: [
        ...state.boundaries,
        Object.freeze({ sequence, phaseId: nextPhase.id, cycle, atGameMs: boundaryMs }),
      ],
    });
  }
}
