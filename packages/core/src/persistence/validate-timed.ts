import type { SerializedScopeState } from "./types.js";

export function validateTimedShape(scope: SerializedScopeState): void {
  for (const [id, task] of Object.entries(scope.tasks ?? {})) {
    exact(task, ["nextSequence", "queue", "active", "completed", "refunds"], `task ${id}`);
    if (
      !Array.isArray(task.queue) ||
      !Array.isArray(task.completed) ||
      !Array.isArray(task.refunds)
    )
      throw new TypeError(`Invalid saved task collections: ${id}`);
    for (const entry of task.queue)
      exact(entry, ["sequence", "escrow", "outputs"], `task queue ${id}`);
    if (task.active) {
      const progress = task.active.mode === "fixed-duration" ? "remainingMs" : "remainingWork";
      exact(task.active, ["sequence", "mode", progress, "escrow", "outputs"], `active task ${id}`);
    }
    for (const claim of [...task.completed, ...task.refunds])
      exact(claim, ["sequence", "quantities"], `task claim ${id}`);
  }
  for (const [id, calendar] of Object.entries(scope.calendars ?? {})) {
    exact(calendar, ["phaseIndex", "elapsedMs", "cycle", "boundaries"], `calendar ${id}`);
    if (!Array.isArray(calendar.boundaries)) throw new TypeError(`Invalid calendar ledger: ${id}`);
    for (const boundary of calendar.boundaries)
      exact(boundary, ["sequence", "phaseId", "cycle", "atGameMs"], `calendar boundary ${id}`);
  }
  for (const [id, market] of Object.entries(scope.markets ?? {}))
    exact(market, ["bought", "sold"], `market ${id}`);
}

function exact(value: object, allowed: readonly string[], label: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`Invalid ${label}`);
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) throw new TypeError(`Unexpected ${label} field: ${unexpected}`);
}
