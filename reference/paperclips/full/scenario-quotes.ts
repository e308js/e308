import type { Snapshot } from "../../../packages/core/src/index.js";
import type {
  ConstraintEvidence,
  LegalActionQuote,
} from "../../../packages/core/src/testing/index.js";
import { paperclipsBuyable } from "./buyable-map.js";
import { paperclipsResources } from "./model.js";
import {
  businessProjects,
  industryProjects,
  type PaperclipsProject,
  spaceProjects,
} from "./projects.js";
import {
  type PaperclipsBuyableId,
  type PaperclipsIntent,
  type ProbeTarget,
  paperclipsPhase,
} from "./types.js";

export function paperclipsBusinessQuotes(
  snapshot: Snapshot<number>,
): readonly LegalActionQuote<PaperclipsIntent>[] {
  if (paperclipsPhase(snapshot) !== "business") return [];
  return [
    ...businessProjects.map((project) => projectQuote(snapshot, project)),
    tournamentQuote(snapshot),
    wireQuote(snapshot),
    ...computeQuotes(snapshot),
    machineQuote(snapshot, "mega-clipper"),
    machineQuote(snapshot, "auto-clipper"),
    machineQuote(snapshot, "marketing"),
    makeQuote(snapshot),
  ];
}

export function paperclipsFullQuotes(
  snapshot: Snapshot<number>,
): readonly LegalActionQuote<PaperclipsIntent>[] {
  const phase = paperclipsPhase(snapshot);
  if (phase === "business") return paperclipsBusinessQuotes(snapshot);
  if (phase === "industry") return industryQuotes(snapshot);
  if (phase === "space") return spaceQuotes(snapshot);
  return [];
}

export function fullConstraints(snapshot: Snapshot<number>): readonly ConstraintEvidence[] {
  const phase = paperclipsPhase(snapshot);
  if (phase === "business") return projectConstraints(snapshot, lastProject(businessProjects));
  if (phase === "industry") return projectConstraints(snapshot, lastProject(industryProjects));
  return projectConstraints(snapshot, lastProject(spaceProjects));
}

function lastProject(projects: readonly PaperclipsProject[]): PaperclipsProject {
  const project = projects.at(-1);
  if (!project) throw new TypeError("Paperclips phase needs a terminal project");
  return project;
}

function industryQuotes(snapshot: Snapshot<number>): readonly LegalActionQuote<PaperclipsIntent>[] {
  const machineIds = ["solar-farm", "battery", "factory", "wire-drone", "harvester"] as const;
  return [
    ...industryProjects.map((project) => projectQuote(snapshot, project)),
    tournamentQuote(snapshot),
    ...computeQuotes(snapshot),
    ...machineIds.map((id) => machineQuote(snapshot, id)),
  ];
}

function spaceQuotes(snapshot: Snapshot<number>): readonly LegalActionQuote<PaperclipsIntent>[] {
  return [
    ...spaceProjects.map((project) => projectQuote(snapshot, project)),
    ...probeDesignQuotes(snapshot),
    tournamentQuote(snapshot),
    ...computeQuotes(snapshot),
  ];
}

function projectQuote(
  snapshot: Snapshot<number>,
  project: PaperclipsProject,
): LegalActionQuote<PaperclipsIntent> {
  return quote(
    snapshot,
    `project:${project.id}`,
    { type: "project", id: project.id },
    projectConstraints(snapshot, project),
    1_000,
  );
}

function tournamentQuote(snapshot: Snapshot<number>): LegalActionQuote<PaperclipsIntent> {
  const constraints: ConstraintEvidence[] = [];
  if (!snapshot.progression.upgrades["strategic-modeling"])
    constraints.push({ kind: "prerequisite", id: "strategic-modeling", detail: "strategy engine" });
  requireAmount(snapshot, "operations", 1_000, constraints);
  if ((snapshot.resources.yomi ?? 0) >= 100_000)
    constraints.push({ kind: "policy", id: "yomi", detail: "campaign reserve reached" });
  return quote(
    snapshot,
    "tournament:minimax",
    { type: "tournament", strategy: "minimax" },
    constraints,
    990,
  );
}

function wireQuote(snapshot: Snapshot<number>): LegalActionQuote<PaperclipsIntent> {
  const cost = snapshot.resources[paperclipsResources.wireCost.id] ?? 0;
  const constraints: ConstraintEvidence[] = [];
  requireAmount(snapshot, paperclipsResources.funds.id, cost, constraints);
  return quote(
    snapshot,
    "buy-wire",
    { type: "buy-wire" },
    constraints,
    (snapshot.resources.wire ?? 0) < 500 ? 950 : 80,
  );
}

function computeQuotes(snapshot: Snapshot<number>): readonly LegalActionQuote<PaperclipsIntent>[] {
  const trust = snapshot.resources.trust ?? 0;
  const processors = snapshot.allocations.compute?.processors ?? 0;
  const memory = snapshot.allocations.compute?.memory ?? 0;
  const constraints: ConstraintEvidence[] = [];
  if (processors + memory >= trust)
    constraints.push({ kind: "insufficient-input", id: "trust", detail: "unassigned trust" });
  return [
    quote(
      snapshot,
      "compute:memory",
      { type: "compute", target: "memory" },
      constraints,
      memory < 75 ? 850 : 40,
    ),
    quote(
      snapshot,
      "compute:processor",
      { type: "compute", target: "processor" },
      constraints,
      processors < 20 ? 840 : 30,
    ),
  ];
}

function machineQuote(
  snapshot: Snapshot<number>,
  id: PaperclipsBuyableId,
): LegalActionQuote<PaperclipsIntent> {
  const buyable = paperclipsBuyable(id);
  const count = snapshot.purchaseCounts[buyable.id] ?? 0;
  const constraints: ConstraintEvidence[] = [];
  if (id === "mega-clipper" && !snapshot.progression.upgrades["mega-clippers"])
    constraints.push({ kind: "prerequisite", id: "mega-clippers", detail: "project" });
  const prerequisite = machinePrerequisite(id);
  if (prerequisite && !snapshot.progression.upgrades[prerequisite])
    constraints.push({ kind: "prerequisite", id: prerequisite, detail: id });
  const target = machineTarget(id);
  if (count >= target)
    constraints.push({ kind: "policy", id, detail: `campaign target ${target}` });
  requireAmount(
    snapshot,
    isBusinessMachine(id) ? "funds" : "clips",
    buyable.curve.unitCost(count),
    constraints,
  );
  return quote(snapshot, `buy:${id}`, { type: "buy", id }, constraints, machineRank(id, count));
}

function probeDesignQuotes(
  snapshot: Snapshot<number>,
): readonly LegalActionQuote<PaperclipsIntent>[] {
  const targets: Readonly<Record<ProbeTarget, number>> = {
    speed: 2,
    navigation: 2,
    replication: 5,
    hazard: 3,
    factory: 2,
    harvester: 2,
    wire: 2,
    combat: 2,
  };
  const allocated = snapshot.allocations["probe-design"] ?? {};
  const total = Object.values(allocated).reduce((sum, value) => sum + value, 0);
  const budget = snapshot.resources[paperclipsResources.probeTrust.id] ?? 0;
  return (Object.keys(targets) as ProbeTarget[]).map((target) => {
    const desired = targets[target];
    const current = allocated[target] ?? 0;
    const constraints: ConstraintEvidence[] = [];
    if (current >= desired)
      constraints.push({ kind: "policy", id: target, detail: "design target reached" });
    if (total - current + desired > budget)
      constraints.push({ kind: "allocation", id: target, detail: "probe trust" });
    return quote(
      snapshot,
      `probe:${target}`,
      { type: "allocate-probe", target, amount: desired },
      constraints,
      950,
    );
  });
}

function makeQuote(snapshot: Snapshot<number>): LegalActionQuote<PaperclipsIntent> {
  const constraints: ConstraintEvidence[] = [];
  requireAmount(snapshot, "wire", 1, constraints);
  const count = Math.min(100, Math.floor(snapshot.resources.wire ?? 0));
  return quote(snapshot, "make-clip", { type: "make-clip", count }, constraints, 200);
}

function projectConstraints(
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
  if (project.operations) requireAmount(snapshot, "operations", project.operations, constraints);
  if (project.creativity) requireAmount(snapshot, "creativity", project.creativity, constraints);
  if (project.yomi) requireAmount(snapshot, "yomi", project.yomi, constraints);
  if (project.clips) requireAmount(snapshot, "clips", project.clips, constraints);
  if (project.trust) requireFreeTrust(snapshot, project.trust, constraints);
  if (project.id === "spectral-froth-annealment")
    requireAmount(snapshot, paperclipsResources.wireSupply.id, 5_000, constraints);
  if (project.id === "quantum-foam-annealment")
    requireAmount(snapshot, paperclipsResources.wireCost.id, 125, constraints);
  return constraints;
}

function requireFreeTrust(
  snapshot: Snapshot<number>,
  amount: number,
  constraints: ConstraintEvidence[],
): void {
  const used = Object.values(snapshot.allocations.compute ?? {}).reduce(
    (sum, value) => sum + value,
    0,
  );
  if ((snapshot.resources.trust ?? 0) - used < amount)
    constraints.push({ kind: "insufficient-input", id: "trust", detail: `${amount} free trust` });
}

function requireAmount(
  snapshot: Snapshot<number>,
  id: string,
  amount: number,
  constraints: ConstraintEvidence[],
): void {
  if ((snapshot.resources[id] ?? 0) < amount)
    constraints.push({ kind: "insufficient-input", id, detail: String(amount) });
}

function quote(
  snapshot: Snapshot<number>,
  id: string,
  intent: PaperclipsIntent,
  constraints: readonly ConstraintEvidence[],
  rank: number,
): LegalActionQuote<PaperclipsIntent> {
  return {
    id,
    revision: snapshot.revision.toString(),
    intent,
    legal: constraints.length === 0,
    useful: true,
    rank,
    constraints,
  };
}

function machinePrerequisite(id: PaperclipsBuyableId): string | undefined {
  const prerequisites: Partial<Record<PaperclipsBuyableId, string>> = {
    harvester: "power-grid",
    "wire-drone": "power-grid",
    factory: "power-grid",
    "solar-farm": "power-grid",
    battery: "power-grid",
  };
  return prerequisites[id];
}

function isBusinessMachine(id: PaperclipsBuyableId): boolean {
  return id === "auto-clipper" || id === "mega-clipper" || id === "marketing";
}

function machineTarget(id: PaperclipsBuyableId): number {
  if (id === "auto-clipper") return 50;
  if (id === "mega-clipper") return 25;
  if (id === "marketing") return 10;
  if (id === "factory" || id === "battery" || id === "solar-farm") return 5;
  return 10;
}

function machineRank(id: PaperclipsBuyableId, count: number): number {
  if (id === "mega-clipper") return 800;
  if (id === "auto-clipper") return 700;
  if (id === "factory" && count === 0) return 900;
  if (id === "solar-farm") return 890;
  if (id === "battery") return 880;
  if (id === "harvester") return 870;
  if (id === "wire-drone") return 860;
  return 750;
}
