import type { Snapshot } from "@e308/core";
import type { ConstraintEvidence } from "@e308/core/testing";
import { paperclipsResources } from "./model.js";
import { appendProjectTriggerConstraints } from "./project-quote-constraints.js";
import {
  businessProjects,
  industryProjects,
  type PaperclipsProject,
  spaceProjects,
} from "./projects.js";
import { requireAmount } from "./quote-helpers.js";
import { paperclipsPhase } from "./types.js";

export function fullConstraints(snapshot: Snapshot<number>): readonly ConstraintEvidence[] {
  const phase = paperclipsPhase(snapshot);
  if (phase === "business") return projectConstraints(snapshot, lastProject(businessProjects));
  if (phase === "industry") return projectConstraints(snapshot, lastProject(industryProjects));
  return projectConstraints(snapshot, lastProject(spaceProjects));
}

export function projectConstraints(
  snapshot: Snapshot<number>,
  project: PaperclipsProject,
): ConstraintEvidence[] {
  const constraints: ConstraintEvidence[] = [];
  if (snapshot.progression.upgrades[project.id])
    constraints.push({ kind: "other", id: project.id, detail: "project complete" });
  for (const id of project.prerequisites) {
    if (!snapshot.progression.upgrades[id])
      constraints.push({ kind: "prerequisite", id, detail: project.id });
  }
  requireResource(snapshot, "operations", project.operations, constraints);
  requireResource(snapshot, "creativity", project.creativity, constraints);
  requireResource(snapshot, "yomi", project.yomi, constraints);
  requireResource(snapshot, "funds", project.funds, constraints);
  requireResource(snapshot, "clips", project.clips, constraints);
  if (project.trustCost && project.id !== "beg-for-more-wire") {
    requireAmount(snapshot, "trust", project.trustCost, constraints);
  }
  appendPhotonicConstraints(snapshot, project, constraints);
  appendProjectTriggerConstraints(snapshot, project, constraints);
  if (project.id === "spectral-froth-annealment")
    requireAmount(snapshot, paperclipsResources.wireSupply.id, 5_000, constraints);
  if (project.id === "quantum-foam-annealment")
    requireAmount(snapshot, paperclipsResources.wireCost.id, 125, constraints);
  return constraints;
}

function appendPhotonicConstraints(
  snapshot: Snapshot<number>,
  project: PaperclipsProject,
  constraints: ConstraintEvidence[],
): void {
  if (project.effect.kind !== "photonic-chip") return;
  requireAmount(
    snapshot,
    "operations",
    snapshot.resources[paperclipsResources.photonicChipCost.id] ?? 10_000,
    constraints,
  );
  if ((snapshot.resources[paperclipsResources.photonicChips.id] ?? 0) >= 10) {
    constraints.push({ kind: "policy", id: "photonic-chip", detail: "all ten chips active" });
  }
}

function requireResource(
  snapshot: Snapshot<number>,
  id: string,
  amount: number | undefined,
  constraints: ConstraintEvidence[],
): void {
  if (amount) requireAmount(snapshot, id, amount, constraints);
}

function lastProject(projects: readonly PaperclipsProject[]): PaperclipsProject {
  const project = projects.at(-1);
  if (!project) throw new TypeError("Paperclips phase needs a terminal project");
  return project;
}
