export interface TimeState {
  readonly gameTimeMs: number;
  readonly remainderMs: number;
}

export interface AdvancePlan extends TimeState {
  readonly steps: number;
}

function safeDuration(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new TypeError(`${name} must be a nonnegative safe integer`);
}

export function planAdvance(state: TimeState, elapsedMs: number, stepMs: number): AdvancePlan {
  safeDuration(state.gameTimeMs, "gameTimeMs");
  safeDuration(state.remainderMs, "remainderMs");
  safeDuration(elapsedMs, "elapsedMs");
  if (!Number.isSafeInteger(stepMs) || stepMs < 1)
    throw new TypeError("stepMs must be a positive safe integer");
  if (state.remainderMs >= stepMs) throw new TypeError("remainderMs must be less than stepMs");
  const available = state.remainderMs + elapsedMs;
  if (!Number.isSafeInteger(available))
    throw new RangeError("accumulated time exceeds the safe integer range");
  const steps = Math.floor(available / stepMs);
  const advancedMs = steps * stepMs;
  const gameTimeMs = state.gameTimeMs + advancedMs;
  if (!Number.isSafeInteger(gameTimeMs))
    throw new RangeError("game time exceeds the safe integer range");
  return Object.freeze({ gameTimeMs, remainderMs: available - advancedMs, steps });
}
