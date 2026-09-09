import type { Snapshot } from "@e308/core";
import { createWireworks, wireworksProjects, wireworksView } from "@e308/game-wireworks";
import { describe, expect, it } from "vitest";
import { marketNodes, productionPanel } from "../../games/wireworks/src/view-actions.js";
import {
  marketDescription,
  projectDescription,
  wireworksGoal,
} from "../../games/wireworks/src/view-copy.js";
import { projectNode, visibleProjects } from "../../games/wireworks/src/view-projects.js";

describe("Wireworks view contracts", () => {
  it("explains every market band and handles unknown extension projects", () => {
    expect(marketDescription("volume")).toContain("market reach");
    expect(marketDescription("standard")).toContain("0.25");
    expect(marketDescription("premium")).toContain("cash per clip");
    expect(projectDescription("extension-project")).toBe("Wireworks engineering project");
  });

  it("renders resource, capacity, machine, and market blockers", () => {
    const initial = createWireworks().getSnapshot();
    const empty = { ...initial, resources: {}, purchaseCounts: {} };
    const full = {
      ...initial,
      resources: { ...initial.resources, cash: 10_000, matter: 500, clips: 500, demand: 100 },
      purchaseCounts: { "bench-extruder": 2, "clip-assembler": 3 },
    };

    expect(JSON.stringify(productionPanel(empty))).toContain("insufficient");
    expect(JSON.stringify(productionPanel(full))).toContain("capacity-blocked");
    expect(JSON.stringify(productionPanel(full))).toContain("Buy bench extruder");
    expect(JSON.stringify(marketNodes(empty))).toContain("insufficient");
    expect(marketNodes(full).every((node) => node.kind === "action" && node.action.enabled)).toBe(
      true,
    );
  });

  it("tracks goals, doctrine visibility, sparse power, and completed controls", () => {
    const initial = createWireworks().getSnapshot();
    expect(wireworksGoal(initial)).toContain("powered extrusion");

    const priced = withUpgrades(initial, [
      "bench-tools",
      "storefront",
      "demand-survey",
      "powered-extrusion",
      "battery-bank",
      "assembler-line",
      "price-model",
    ]);
    expect(wireworksGoal(priced)).toContain("seed autonomous control");
    expect(visibleProjects(priced).map((project) => project.id)).toEqual([
      "durable-drive",
      "throughput-drive",
    ]);

    const durable = withUpgrades(priced, ["durable-drive"]);
    expect(visibleProjects(durable).map((project) => project.id)).toContain("autonomous-control");
    expect(visibleProjects(durable).map((project) => project.id)).not.toContain("throughput-drive");
    expect(JSON.stringify(wireworksView({ ...durable, resources: {}, allocations: {} }))).toContain(
      "durability",
    );

    const autonomous = withUpgrades(durable, ["autonomous-control"]);
    expect(wireworksGoal({ ...autonomous, resources: {} })).toContain("0 drones, 0 relays");

    const finalProject = wireworksProjects.find((project) => project.id === "final-expansion");
    if (!finalProject) throw new TypeError("final project fixture is missing");
    expect(JSON.stringify(projectNode(initial, finalProject))).toContain("200 drones");

    const won = { ...autonomous, progression: { ...autonomous.progression, won: true } };
    expect(wireworksGoal(won)).toContain("Network complete");
    expect(JSON.stringify(wireworksView(won))).toContain("game-complete");
  });
});

function withUpgrades(snapshot: Snapshot<number>, ids: readonly string[]): Snapshot<number> {
  return {
    ...snapshot,
    progression: {
      ...snapshot.progression,
      upgrades: {
        ...snapshot.progression.upgrades,
        ...(Object.fromEntries(ids.map((id) => [id, true])) as Record<string, true>),
      },
    },
  };
}
