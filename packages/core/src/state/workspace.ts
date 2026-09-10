import { cloneRecords } from "../domain/state.js";
import type { PendingDomainEvent } from "../domain/types.js";
import { RandomStreams } from "../random/xoshiro.js";
import { cloneProgression } from "./progression-state.js";
import { cloneCalendars, cloneTasks } from "./timed-state.js";
import type { Snapshot } from "./types.js";

export function createTransactionWorkspace<N>(snapshot: Snapshot<N>) {
  return {
    resources: { ...snapshot.resources },
    purchaseCounts: { ...snapshot.purchaseCounts },
    allocations: Object.fromEntries(
      Object.entries(snapshot.allocations).map(([id, assignments]) => [id, { ...assignments }]),
    ),
    productionTotals: { ...snapshot.productionTotals },
    scopeGenerations: { ...snapshot.scopeGenerations },
    progression: cloneProgression(snapshot.progression),
    random: new RandomStreams(snapshot.random.rootSeed, snapshot.random.streams),
    tasks: cloneTasks(snapshot.tasks),
    calendars: cloneCalendars(snapshot.calendars),
    markets: Object.fromEntries(
      Object.entries(snapshot.markets).map(([id, state]) => [id, { ...state }]),
    ),
    records: cloneRecords(snapshot.records),
    pendingEvents: [] as PendingDomainEvent[],
  };
}
