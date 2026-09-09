import type { Scope } from "../model/handles.js";

export interface CalendarPhase {
  readonly id: string;
  readonly durationMs: number;
}

export interface CalendarDefinition {
  readonly id: string;
  readonly scope: Scope;
  readonly phases: readonly CalendarPhase[];
}

export interface CalendarBoundary {
  readonly sequence: bigint;
  readonly phaseId: string;
  readonly cycle: bigint;
  readonly atGameMs: number;
}

export interface CalendarState {
  readonly phaseIndex: number;
  readonly elapsedMs: number;
  readonly cycle: bigint;
  readonly boundaries: readonly CalendarBoundary[];
}
