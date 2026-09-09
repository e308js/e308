import type { Snapshot } from "@e308/core";
import type { ViewNode } from "@e308/ux";
import {
  foodConsumptionMultiplier,
  hearthCalendar,
  laborMultiplier,
  seasonFactor,
} from "./content.js";
import type { HearthIntent } from "./runtime.js";

export function seasonalLedger(snapshot: Snapshot<number>): ViewNode<HearthIntent, number> {
  const assignments = snapshot.allocations.jobs ?? {};
  const phase = hearthCalendar.phases[snapshot.calendars.seasons?.phaseIndex ?? 0]?.id ?? "spring";
  const labor = laborMultiplier(snapshot.resources.tools ?? 0, snapshot.resources.morale ?? 0);
  const crop = snapshot.progression.upgrades["crop-rotation"] ? 1.5 : 1;
  const foodGross = (assignments.farmer ?? 0) * seasonFactor(phase) * labor * crop;
  const foodUse =
    (snapshot.resources.workers ?? 0) *
    0.4 *
    foodConsumptionMultiplier(phase, snapshot.resources.preserves ?? 0);
  const rates = [
    ["food", foodGross - foodUse],
    ["wood", (assignments.woodcutter ?? 0) * labor],
    ["stone", (assignments.miner ?? 0) * 0.7 * labor],
    ["science", (assignments.scholar ?? 0) * 0.5 * labor],
    ["herbs", phase === "spring" || phase === "autumn" ? (assignments.farmer ?? 0) * 0.08 : 0],
  ] as const;
  return {
    kind: "custom",
    id: "seasonal-ledger",
    render(document) {
      const table = document.createElement("table");
      table.setAttribute("aria-label", "Seasonal production ledger");
      const caption = document.createElement("caption");
      caption.textContent = "Current net rates";
      table.append(caption);
      for (const [resource, amount] of rates) {
        const row = document.createElement("tr");
        const name = document.createElement("th");
        const value = document.createElement("td");
        name.textContent = resource;
        value.textContent = `${amount >= 0 ? "+" : ""}${amount.toFixed(2)} / second`;
        row.append(name, value);
        table.append(row);
      }
      return table;
    },
  };
}
