import type { Snapshot } from "@e308/core";
import type { ViewDocument, ViewNode } from "@e308/ux";
import type { WireworksIntent } from "./runtime.js";
import { marketNodes, productionPanel } from "./view-actions.js";
import { wireworksGoal } from "./view-copy.js";
import { projectNode, projectNodes, visibleProjects } from "./view-projects.js";

const labels: Readonly<Record<string, string>> = {
  cash: "Cash",
  matter: "Feedstock",
  wire: "Wire",
  clips: "Clip inventory",
  demand: "Demand",
  reach: "Market reach",
  efficiency: "Machine efficiency",
  power: "Grid power",
  drones: "Replication drones",
  probes: "Orbital relays",
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
              "Turn purchased feedstock into wire and clips, develop the market, and build a self-expanding relay network.",
          },
        ],
      },
      { kind: "notification", id: "goal", text: wireworksGoal(snapshot), tone: "neutral" },
      storyPanel(snapshot, era.title),
      { kind: "row", id: "stocks", children: stockNodes(snapshot) },
      productionPanel(snapshot),
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
            text: "Three orbital relays join the autonomous network. Wireworks is complete.",
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

function gridNodes(snapshot: Snapshot<number>): ViewNode<WireworksIntent, number>[] {
  const assigned = snapshot.allocations.grid ?? {};
  const power = snapshot.resources.power ?? 0;
  const total = (assigned.extrusion ?? 0) + (assigned.assembly ?? 0);
  return (["extrusion", "assembly"] as const).map((target) => ({
    kind: "range-input",
    id: `allocate-${target}`,
    label: `${target} power`,
    value: assigned[target] ?? 0,
    min: 0,
    max: power,
    allowedMax: power - total + (assigned[target] ?? 0),
    step: 1,
    showTicks: true,
    intent: (amount) => ({ type: "allocate", target, amount }),
  }));
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
    },
  };
}

function storyPanel(snapshot: Snapshot<number>, era: string): ViewNode<WireworksIntent, number> {
  const choice = snapshot.progression.upgrades["durable-drive"]
    ? "durability"
    : snapshot.progression.upgrades["throughput-drive"]
      ? "throughput"
      : "open";
  return {
    kind: "infobox",
    id: "story",
    title: era,
    initiallyOpen: true,
    content: [
      {
        kind: "description",
        id: "story-copy",
        content: [{ kind: "text", value: `Engineering doctrine: ${choice}.` }],
      },
    ],
  };
}

function currentEra(snapshot: Snapshot<number>): { readonly id: string; readonly title: string } {
  if (snapshot.progression.upgrades["autonomous-control"])
    return { id: "autonomy", title: "Autonomous network" };
  if (snapshot.progression.upgrades["powered-extrusion"])
    return { id: "industry", title: "Powered industry" };
  return { id: "workshop", title: "Workshop sales" };
}
