import type { CalendarState } from "../calendar/types.js";
import type { MarketState } from "../markets/types.js";
import type { TaskState } from "../tasks/types.js";
import { freezeProgression, type MutableProgression } from "./progression-state.js";
import { freezeCalendars, freezeMarkets, freezeTasks } from "./timed-state.js";
import type { Snapshot } from "./types.js";

export type SnapshotParts<N> = Pick<
  Snapshot<N>,
  | "revision"
  | "gameTimeMs"
  | "remainderMs"
  | "resources"
  | "purchaseCounts"
  | "allocations"
  | "productionTotals"
  | "scopeGenerations"
  | "random"
> & {
  readonly progression: MutableProgression<N>;
  readonly tasks: Record<string, TaskState<N>>;
  readonly calendars: Record<string, CalendarState>;
  readonly markets: Record<string, MarketState<N>>;
};

export function makeSnapshot<N>(parts: SnapshotParts<N>): Snapshot<N> {
  const allocations = Object.fromEntries(
    Object.entries(parts.allocations).map(([id, values]) => [id, Object.freeze(values)]),
  );
  return Object.freeze({
    ...parts,
    resources: Object.freeze(parts.resources),
    purchaseCounts: Object.freeze(parts.purchaseCounts),
    allocations: Object.freeze(allocations),
    productionTotals: Object.freeze(parts.productionTotals),
    scopeGenerations: Object.freeze(parts.scopeGenerations),
    progression: freezeProgression(parts.progression),
    tasks: freezeTasks(parts.tasks),
    calendars: freezeCalendars(parts.calendars),
    markets: freezeMarkets(parts.markets),
  });
}
