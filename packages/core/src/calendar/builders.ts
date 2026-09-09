import { owned } from "../model/handles.js";
import { assertOwner, validId } from "../model/validation.js";
import type { CalendarDefinition } from "./types.js";

export type CalendarOptions = Omit<CalendarDefinition, "id">;

export function createCalendar(
  id: string,
  options: CalendarOptions,
  owner: object,
): CalendarDefinition {
  validId(id, "calendar");
  assertOwner(options.scope, owner, `Scope for ${id}`);
  if (options.phases.length === 0)
    throw new TypeError(`Calendar ${id} requires at least one phase`);
  const ids = new Set<string>();
  const phases = options.phases.map((phase) => {
    validId(phase.id, "calendar phase");
    if (ids.has(phase.id)) throw new TypeError(`Duplicate calendar phase: ${phase.id}`);
    if (!Number.isSafeInteger(phase.durationMs) || phase.durationMs < 1)
      throw new TypeError(`Calendar phase ${phase.id} requires a positive duration`);
    ids.add(phase.id);
    return Object.freeze({ ...phase });
  });
  return owned({ id, scope: options.scope, phases: Object.freeze(phases) }, owner);
}
