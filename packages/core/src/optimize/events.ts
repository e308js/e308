import type { BulkCapability, BulkPlanContext } from "./types.js";

export function eventBoundedCapability<N>(
  capability: BulkCapability<N>,
  nextBoundaryGameMs: (context: BulkPlanContext<N>) => number,
): BulkCapability<N> {
  return Object.freeze({
    ...capability,
    id: `${capability.id}/event-bounded`,
    dependencies: Object.freeze([...capability.dependencies, "authored-event-boundary"]),
    plan: (context: BulkPlanContext<N>) => {
      const boundary = nextBoundaryGameMs(context);
      if (!Number.isSafeInteger(boundary) || boundary <= context.snapshot.gameTimeMs)
        return {
          eligible: false,
          reason: "event-boundary-due",
          retryAfterCanonicalSteps: 1,
        } as const;
      const before = Math.floor(
        (boundary - context.snapshot.gameTimeMs - 1) / context.definition.stepMs,
      );
      if (before < 1)
        return {
          eligible: false,
          reason: "event-boundary-next-step",
          retryAfterCanonicalSteps: 1,
        } as const;
      return capability.plan({
        ...context,
        requestedSteps: Math.min(context.requestedSteps, before),
      });
    },
  });
}
