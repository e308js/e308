import type { BulkPlanContext } from "./types.js";

export function stepsBeforeAutomation<N>(context: BulkPlanContext<N>, enabledOnly = false): number {
  let steps = context.requestedSteps;
  for (const automation of context.definition.automation ?? []) {
    const state = context.snapshot.progression.automation[automation.id];
    if (enabledOnly && !(state?.enabled ?? automation.initiallyEnabled)) continue;
    const next = state?.nextRunMs ?? automation.cadenceMs;
    const before = Math.floor((next - context.snapshot.gameTimeMs - 1) / context.definition.stepMs);
    steps = Math.min(steps, Math.max(0, before));
  }
  return steps;
}
