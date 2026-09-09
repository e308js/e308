import type { Snapshot } from "@e308/core";
import type { ActionBlocker, ActionView, ViewNode } from "@e308/ux";
import { wireworksBuyables } from "./content.js";
import type { WireworksBand, WireworksIntent, WireworksMachine } from "./runtime.js";
import { marketDescription } from "./view-copy.js";

export function productionPanel(snapshot: Snapshot<number>): ViewNode<WireworksIntent, number> {
  const efficiency = snapshot.resources.efficiency ?? 1;
  const extruders = snapshot.purchaseCounts[wireworksBuyables.extruder.id] ?? 0;
  const assemblers = snapshot.purchaseCounts[wireworksBuyables.assembler.id] ?? 0;
  return {
    kind: "infobox",
    id: "production-chain",
    title: "Production chain: feedstock → wire → clips",
    initiallyOpen: true,
    content: [
      {
        kind: "quantities",
        id: "machine-rates",
        lines: [
          { resourceId: "extruders", label: "Bench extruders", value: extruders },
          {
            resourceId: "wire-rate",
            label: "Bench wire per second",
            value: extruders * efficiency * 3,
          },
          { resourceId: "assemblers", label: "Clip assemblers", value: assemblers },
          {
            resourceId: "clip-rate",
            label: "Bench clips per second",
            value: assemblers * efficiency * 3,
          },
        ],
      },
      supplyAction(snapshot),
      machineAction(snapshot, "extruder"),
      machineAction(snapshot, "assembler"),
      makeClipAction(snapshot),
    ],
  };
}

function supplyAction(snapshot: Snapshot<number>): ViewNode<WireworksIntent, number> {
  const cash = snapshot.resources.cash ?? 0;
  const matter = snapshot.resources.matter ?? 0;
  const capacity = 500 + (snapshot.resources.storage ?? 0) * 1_000;
  const blockers: ActionBlocker<number>[] = [];
  if (cash < 10)
    blockers.push({ kind: "insufficient", resourceId: "cash", required: 10, available: cash });
  if (capacity - matter < 200)
    blockers.push({
      kind: "capacity-blocked",
      resourceId: "matter",
      attempted: matter + 200,
      capacity,
    });
  return {
    kind: "action",
    id: "buy-feedstock",
    action: {
      id: "supply",
      label: "Buy 200 feedstock",
      description: [{ kind: "text", value: "Feedstock is consumed by extruders and drones." }],
      enabled: blockers.length === 0,
      intent: { type: "supply" },
      blockers,
      costs: [{ resourceId: "cash", label: "Cash", value: 10 }],
      rewards: [{ resourceId: "matter", label: "Feedstock", value: 200 }],
    },
  };
}

function machineAction(
  snapshot: Snapshot<number>,
  machine: WireworksMachine,
): ViewNode<WireworksIntent, number> {
  const definition = wireworksBuyables[machine];
  const count = snapshot.purchaseCounts[definition.id] ?? 0;
  const cost = definition.curve.unitCost(count);
  const cash = snapshot.resources.cash ?? 0;
  const blockers: ActionBlocker<number>[] = [];
  if (cash < cost)
    blockers.push({ kind: "insufficient", resourceId: "cash", required: cost, available: cash });
  const extruder = machine === "extruder";
  return {
    kind: "action",
    id: `buy-${machine}`,
    action: {
      id: `buy-${machine}`,
      label: `Buy ${extruder ? "bench extruder" : "clip assembler"}`,
      description: [
        {
          kind: "text",
          value: extruder
            ? "Each extruder turns one feedstock into three wire per cycle."
            : "Each assembler turns two wire into four clips per cycle.",
        },
      ],
      enabled: blockers.length === 0,
      intent: { type: "buy-machine", machine, count: 1 },
      blockers,
      costs: [{ resourceId: "cash", label: "Cash", value: cost }],
    },
  };
}

function makeClipAction(snapshot: Snapshot<number>): ViewNode<WireworksIntent, number> {
  const wire = snapshot.resources.wire ?? 0;
  const clips = snapshot.resources.clips ?? 0;
  const capacity = 500 + (snapshot.resources.storage ?? 0) * 500;
  const blockers: ActionBlocker<number>[] = [];
  if (wire < 1)
    blockers.push({ kind: "insufficient", resourceId: "wire", required: 1, available: wire });
  if (clips >= capacity)
    blockers.push({
      kind: "capacity-blocked",
      resourceId: "clips",
      attempted: clips + 1,
      capacity,
    });
  return {
    kind: "action",
    id: "make-clip",
    action: {
      id: "make",
      label: "Make one clip by hand",
      enabled: blockers.length === 0,
      intent: { type: "make" },
      blockers,
      costs: [{ resourceId: "wire", label: "Wire", value: 1 }],
      rewards: [{ resourceId: "clips", label: "Clip", value: 1 }],
      hold: { intent: { type: "make" }, repeatMs: 100 },
    },
  };
}

export function marketNodes(snapshot: Snapshot<number>): ViewNode<WireworksIntent, number>[] {
  return (["volume", "standard", "premium"] as const).map((band) => ({
    kind: "action",
    id: `sell-${band}`,
    action: saleAction(snapshot, band),
  }));
}

function saleAction(
  snapshot: Snapshot<number>,
  band: WireworksBand,
): ActionView<WireworksIntent, number> {
  const quantity = band === "volume" ? 20 : band === "standard" ? 10 : 5;
  const demand = band === "volume" ? 5 : band === "standard" ? 10 : 20;
  const price = band === "volume" ? 2 : band === "standard" ? 5 : 12;
  const clips = snapshot.resources.clips ?? 0;
  const availableDemand = snapshot.resources.demand ?? 0;
  const blockers: ActionBlocker<number>[] = [];
  if (clips < quantity)
    blockers.push({
      kind: "insufficient",
      resourceId: "clips",
      required: quantity,
      available: clips,
    });
  if (availableDemand < demand)
    blockers.push({
      kind: "insufficient",
      resourceId: "demand",
      required: demand,
      available: availableDemand,
    });
  return {
    id: `sell-${band}`,
    label: `Sell ${quantity} clips — ${band}`,
    description: [{ kind: "text", value: marketDescription(band) }],
    enabled: blockers.length === 0,
    intent: { type: "sell", band, quantity },
    blockers,
    costs: [
      { resourceId: "clips", label: "Inventory", value: quantity },
      { resourceId: "demand", label: "Demand", value: demand },
    ],
    rewards: [{ resourceId: "cash", label: "Cash", value: quantity * price }],
  };
}
