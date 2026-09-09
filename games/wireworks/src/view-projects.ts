import type { Snapshot } from "@e308/core";
import type { ActionBlocker, ViewNode } from "@e308/ux";
import { wireworksProjects } from "./content.js";
import type { WireworksIntent } from "./runtime.js";
import { projectDescription } from "./view-copy.js";

export function projectNodes(snapshot: Snapshot<number>): ViewNode<WireworksIntent, number>[] {
  return visibleProjects(snapshot).map((project) => projectNode(snapshot, project));
}

export function projectNode(
  snapshot: Snapshot<number>,
  project: (typeof wireworksProjects)[number],
): ViewNode<WireworksIntent, number> {
  const cost = project.costs[0]?.[1] ?? 0;
  const cash = snapshot.resources.cash ?? 0;
  const missing = project.prerequisiteIds.filter((id) => !snapshot.progression.upgrades[id]);
  const threshold = droneThreshold(project.id);
  const blockers: ActionBlocker<number>[] = [];
  if (missing.length > 0) blockers.push({ kind: "locked", prerequisiteIds: missing });
  if (threshold > (snapshot.resources.drones ?? 0))
    blockers.push({ kind: "locked", prerequisiteIds: [`${threshold} drones`] });
  if (cash < cost)
    blockers.push({ kind: "insufficient", resourceId: "cash", required: cost, available: cash });
  return {
    kind: "action",
    id: `project-${project.id}`,
    action: {
      id: project.id,
      label: project.id.replaceAll("-", " "),
      description: [{ kind: "text", value: projectDescription(project.id) }],
      enabled: blockers.length === 0,
      intent: { type: "project", id: project.id },
      blockers,
      costs: [{ resourceId: "cash", label: "Cash", value: cost }],
    },
  };
}

export function visibleProjects(snapshot: Snapshot<number>) {
  return wireworksProjects.filter((project) => {
    if (snapshot.progression.upgrades[project.id]) return false;
    if (project.id === "durable-drive" && snapshot.progression.upgrades["throughput-drive"])
      return false;
    if (project.id === "throughput-drive" && snapshot.progression.upgrades["durable-drive"])
      return false;
    if (
      project.id === "autonomous-control" &&
      !snapshot.progression.upgrades["durable-drive"] &&
      !snapshot.progression.upgrades["throughput-drive"]
    )
      return false;
    return project.prerequisiteIds.every((id) => snapshot.progression.upgrades[id]);
  });
}

function droneThreshold(id: string): number {
  if (id === "orbital-contract") return 10;
  if (id === "launch-array") return 50;
  if (id === "final-expansion") return 200;
  return 0;
}
