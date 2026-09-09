import type { Snapshot } from "@e308/core";
import type { ActionBlocker, ActionView, ViewDocument, ViewNode } from "@e308/ux";
import { wireworksProjects } from "./content.js";
import type { WireworksBand, WireworksIntent } from "./runtime.js";

const labels: Readonly<Record<string, string>> = {
  cash: "Cash",
  matter: "Matter",
  wire: "Wire",
  clips: "Clip inventory",
  power: "Grid power",
  demand: "Demand",
  drones: "Drones",
  probes: "Orbital probes",
};

export function wireworksView(snapshot: Snapshot<number>): ViewDocument<WireworksIntent, number> {
  const era = currentEra(snapshot);
  return {
    title: `Wireworks — ${era.title}`,
    activeScopeIds: [era.id],
    hotkeys: [
      {
        id: "wait",
        key: "w",
        description: "Run production for ten seconds",
        enabled: !snapshot.progression.won,
        intent: { type: "advance", milliseconds: 10_000 },
        scopeId: era.id,
      },
    ],
    content: [
      { kind: "heading", id: "title", level: 1, text: "Wireworks" },
      {
        kind: "description",
        id: "instructions",
        content: [
          {
            kind: "text",
            value:
              "Manufacture inventory, choose a price band, and reinvest the cash. Power and demand limit different parts of the business.",
          },
        ],
      },
      storyPanel(snapshot, era.title),
      { kind: "row", id: "stocks", children: stockNodes(snapshot) },
      {
        kind: "tabs",
        id: "operations",
        tabs: [
          { id: "market", label: "Market", content: marketNodes(snapshot) },
          { id: "projects", label: "Projects", content: projectNodes(snapshot) },
          {
            id: "grid",
            label: "Power",
            content: gridNodes(snapshot),
            hidden: era.id === "workshop",
          },
        ],
      },
      waitAction(snapshot),
      snapshot.progression.won
        ? {
            kind: "notification",
            id: "ending",
            text: "The launch array opens an autonomous frontier. Wireworks is complete.",
            tone: "positive",
          }
        : { kind: "separator", id: "before-ending" },
      { kind: "save", id: "save-status", status: "clean", message: "Local save available" },
    ],
  };
}

export function wireworksTerminalView(
  snapshot: Snapshot<number>,
): ViewDocument<WireworksIntent, number> {
  const next = visibleProjects(snapshot)[0];
  return {
    title: "Wireworks terminal",
    content: [
      {
        kind: "heading",
        id: "terminal-title",
        level: 1,
        text: `WIREWORKS/${currentEra(snapshot).id}`,
      },
      {
        kind: "quantities",
        id: "terminal-stocks",
        lines: Object.entries(labels).map(([id, label]) => ({
          resourceId: id,
          label: label.toUpperCase(),
          value: snapshot.resources[id] ?? 0,
        })),
      },
      ...marketNodes(snapshot),
      ...(next ? [projectNode(snapshot, next)] : []),
      waitAction(snapshot),
    ],
  };
}

function stockNodes(snapshot: Snapshot<number>): ViewNode<WireworksIntent, number>[] {
  return Object.entries(labels).map(([id, label]) => ({
    kind: "resource",
    id: `stock-${id}`,
    resource: { resourceId: id, label, value: snapshot.resources[id] ?? 0 },
  }));
}

function marketNodes(snapshot: Snapshot<number>): ViewNode<WireworksIntent, number>[] {
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
  const demand = quantity * (band === "volume" ? 1 : band === "standard" ? 2 : 4);
  const price = band === "volume" ? 2 : band === "standard" ? 4 : 7;
  const available = snapshot.resources.clips ?? 0;
  const availableDemand = snapshot.resources.demand ?? 0;
  const blockers: ActionBlocker<number>[] = [];
  if (available < quantity)
    blockers.push({ kind: "insufficient", resourceId: "clips", required: quantity, available });
  if (availableDemand < demand)
    blockers.push({
      kind: "insufficient",
      resourceId: "demand",
      required: demand,
      available: availableDemand,
    });
  return {
    id: `sell-${band}`,
    label: `Sell ${quantity} at ${band} price`,
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

function projectNodes(snapshot: Snapshot<number>): ViewNode<WireworksIntent, number>[] {
  return visibleProjects(snapshot).map((project) => projectNode(snapshot, project));
}

function projectNode(
  snapshot: Snapshot<number>,
  project: (typeof wireworksProjects)[number],
): ViewNode<WireworksIntent, number> {
  const cost = project.costs[0]?.[1] ?? 0;
  const cash = snapshot.resources.cash ?? 0;
  const missing = project.prerequisiteIds.filter((id) => !snapshot.progression.upgrades[id]);
  const blockers: ActionBlocker<number>[] = [];
  if (missing.length > 0) blockers.push({ kind: "locked", prerequisiteIds: missing });
  if (cash < cost)
    blockers.push({ kind: "insufficient", resourceId: "cash", required: cost, available: cash });
  return {
    kind: "action",
    id: `project-${project.id}`,
    action: {
      id: project.id,
      label: project.id.replaceAll("-", " "),
      enabled: blockers.length === 0,
      intent: { type: "project", id: project.id },
      blockers,
      costs: [{ resourceId: "cash", label: "Cash", value: cost }],
    },
  };
}

function visibleProjects(snapshot: Snapshot<number>) {
  return wireworksProjects.filter((project) => {
    if (snapshot.progression.upgrades[project.id]) return false;
    if (project.id === "durable-drive" && snapshot.progression.upgrades["throughput-drive"])
      return false;
    if (project.id === "throughput-drive" && snapshot.progression.upgrades["durable-drive"])
      return false;
    return project.prerequisiteIds.every((id) => snapshot.progression.upgrades[id]);
  });
}

function gridNodes(snapshot: Snapshot<number>): ViewNode<WireworksIntent, number>[] {
  const assigned = snapshot.allocations.grid ?? {};
  return [
    allocationNode("extrusion", assigned.extrusion ?? 0, snapshot.resources.power ?? 0),
    allocationNode("assembly", assigned.assembly ?? 0, snapshot.resources.power ?? 0),
  ];
}

function allocationNode(
  target: "extrusion" | "assembly",
  value: number,
  maximum: number,
): ViewNode<WireworksIntent, number> {
  return {
    kind: "range-input",
    id: `allocate-${target}`,
    label: `${target} power`,
    value,
    min: 0,
    max: maximum,
    step: 1,
    intent: (amount) => ({ type: "allocate", target, amount }),
  };
}

function waitAction(snapshot: Snapshot<number>): ViewNode<WireworksIntent, number> {
  return {
    kind: "action",
    id: "wait-action",
    action: {
      id: "wait",
      label: "Run production for 10 seconds",
      enabled: !snapshot.progression.won,
      intent: { type: "advance", milliseconds: 10_000 },
      blockers: snapshot.progression.won
        ? [{ kind: "disabled", actionId: "wait", reasonKey: "game-complete" }]
        : [],
      hold: { intent: { type: "advance", milliseconds: 10_000 }, repeatMs: 150 },
    },
  };
}

function storyPanel(snapshot: Snapshot<number>, era: string): ViewNode<WireworksIntent, number> {
  const choice = snapshot.progression.upgrades["durable-drive"]
    ? "durability"
    : snapshot.progression.upgrades["throughput-drive"]
      ? "throughput"
      : "unmade";
  return {
    kind: "infobox",
    id: "story",
    title: era,
    initiallyOpen: true,
    content: [
      {
        kind: "description",
        id: "story-copy",
        content: [
          {
            kind: "text",
            value: `Engineering doctrine: ${choice}. Earlier era controls retire as the factory changes.`,
          },
        ],
      },
    ],
  };
}

function currentEra(snapshot: Snapshot<number>): { readonly id: string; readonly title: string } {
  if (snapshot.progression.upgrades["autonomous-control"])
    return { id: "autonomy", title: "Autonomous expansion" };
  if (snapshot.progression.upgrades["powered-extrusion"])
    return { id: "industry", title: "Powered industry" };
  return { id: "workshop", title: "Workshop sales" };
}
