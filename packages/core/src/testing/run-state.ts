import type { HarnessSample, HarnessTraceEntry, HarnessValue, PressureMetric } from "./types.js";

export type MutablePressureMetric = {
  -readonly [Key in keyof PressureMetric]: PressureMetric[Key];
} & { currentNoReliefMs: number };

export interface HarnessTotals<I extends HarnessValue> {
  real: number;
  active: number;
  idle: number;
  absent: number;
  discarded: number;
  banked: number;
  decisions: number;
  attempts: number;
  successful: number;
  waits: number;
  currentWait: number;
  longestWait: number;
  traceTruncated: number;
  samplesTruncated: number;
  workLimited: boolean;
  readonly trace: HarnessTraceEntry<I>[];
  readonly samples: HarnessSample[];
  readonly constraints: Record<string, number>;
  readonly pressures: Record<string, MutablePressureMetric>;
  readonly milestones: Record<
    string,
    { realTimeMs: number; gameTimeMs: number; activeTimeMs: number }
  >;
  readonly fidelity: Set<"canonical" | "validated-bulk" | "approximate" | "custom-reward">;
  diagnostics: { overflow: number; resetRecoveries: number; taskBlocks: number };
}

export function createTotals<I extends HarnessValue>(): HarnessTotals<I> {
  return {
    real: 0,
    active: 0,
    idle: 0,
    absent: 0,
    discarded: 0,
    banked: 0,
    decisions: 0,
    attempts: 0,
    successful: 0,
    waits: 0,
    currentWait: 0,
    longestWait: 0,
    traceTruncated: 0,
    samplesTruncated: 0,
    workLimited: false,
    trace: [],
    samples: [],
    constraints: {},
    pressures: {},
    milestones: {},
    fidelity: new Set(),
    diagnostics: { overflow: 0, resetRecoveries: 0, taskBlocks: 0 },
  };
}
