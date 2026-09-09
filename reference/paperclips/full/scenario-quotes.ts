import type { Snapshot } from "../../../packages/core/src/index.js";
import type {
  ConstraintEvidence,
  LegalActionQuote,
} from "../../../packages/core/src/testing/index.js";
import {
  paperclipsBuyable,
  paperclipsMachinePrerequisite,
  paperclipsMachineRank,
  paperclipsMachineTarget,
} from "./buyable-map.js";
import { paperclipsResources } from "./model.js";
import {
  businessProjects,
  industryProjects,
  type PaperclipsProject,
  persistentPaperclipsProjects,
  spaceProjects,
} from "./projects.js";
import { quantumOperationYield } from "./quantum.js";
import { quote, requireAmount } from "./quote-helpers.js";
import { projectConstraints } from "./scenario-constraints.js";
import { bestPaperclipsStrategy } from "./strategy-state.js";
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
    investmentQuote(snapshot),
    withdrawalQuote(snapshot),
    tournamentQuote(snapshot),
    quantumQuote(snapshot),
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

export { fullConstraints } from "./scenario-constraints.js";

function industryQuotes(snapshot: Snapshot<number>): readonly LegalActionQuote<PaperclipsIntent>[] {
  const machineIds = ["solar-farm", "battery", "factory", "wire-drone", "harvester"] as const;
  return [
    ...industryProjects.map((project) => projectQuote(snapshot, project)),
    ...persistentPaperclipsProjects.map((project) => projectQuote(snapshot, project)),
    tournamentQuote(snapshot),
    ...computeQuotes(snapshot),
    ...machineIds.map((id) => machineQuote(snapshot, id)),
  ];
}

function spaceQuotes(snapshot: Snapshot<number>): readonly LegalActionQuote<PaperclipsIntent>[] {
  const dismantling = (snapshot.resources[paperclipsResources.dismantleStage.id] ?? 0) >= 4;
  return [
    ...spaceProjects.map((project) => projectQuote(snapshot, project)),
    ...persistentPaperclipsProjects.map((project) => projectQuote(snapshot, project)),
    ...probeDesignQuotes(snapshot),
    tournamentQuote(snapshot),
    ...computeQuotes(snapshot),
    ...(dismantling ? [makeQuote(snapshot)] : []),
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
  requireAmount(
    snapshot,
    "operations",
    snapshot.resources[paperclipsResources.tournamentCost.id] ?? 1_000,
    constraints,
  );
  if ((snapshot.resources.yomi ?? 0) >= 100_000)
    constraints.push({ kind: "policy", id: "yomi", detail: "campaign reserve reached" });
  return quote(
    snapshot,
    `tournament:${bestPaperclipsStrategy(snapshot)}`,
    { type: "tournament", strategy: bestPaperclipsStrategy(snapshot) },
    constraints,
    990,
  );
}

function quantumQuote(snapshot: Snapshot<number>): LegalActionQuote<PaperclipsIntent> {
  const constraints: ConstraintEvidence[] = [];
  if ((snapshot.resources[paperclipsResources.photonicChips.id] ?? 0) < 1) {
    constraints.push({ kind: "prerequisite", id: "photonic-chip", detail: "quantum compute" });
  }
  const yieldAmount = quantumOperationYield(
    snapshot.resources[paperclipsResources.quantumClock.id] ?? 0,
    snapshot.resources[paperclipsResources.photonicChips.id] ?? 0,
  );
  if (yieldAmount <= 0) {
    constraints.push({ kind: "policy", id: "quantum-wave", detail: "positive operation yield" });
  }
  return quote(snapshot, "quantum-compute", { type: "quantum-compute" }, constraints, 100);
}

function investmentQuote(snapshot: Snapshot<number>): LegalActionQuote<PaperclipsIntent> {
  const constraints: ConstraintEvidence[] = [];
  if (!snapshot.progression.upgrades["algorithmic-trading"])
    constraints.push({
      kind: "prerequisite",
      id: "algorithmic-trading",
      detail: "investment engine",
    });
  if (snapshot.progression.upgrades["hostile-takeover"])
    constraints.push({ kind: "policy", id: "hostile-takeover", detail: "position closed" });
  const bankroll = snapshot.resources.bankroll ?? 0;
  const amount = Math.min(10_000 - bankroll, snapshot.resources.funds ?? 0);
  if (bankroll >= 10_000)
    constraints.push({ kind: "policy", id: "bankroll", detail: "takeover trigger reached" });
  if (amount <= 0) requireAmount(snapshot, "funds", 1, constraints);
  return quote(snapshot, "invest", { type: "invest", amount }, constraints, 995);
}

function withdrawalQuote(snapshot: Snapshot<number>): LegalActionQuote<PaperclipsIntent> {
  const constraints: ConstraintEvidence[] = [];
  if (!snapshot.progression.upgrades["hostile-takeover"])
    constraints.push({ kind: "prerequisite", id: "hostile-takeover", detail: "close investment" });
  if ((snapshot.resources.bankroll ?? 0) <= 0)
    constraints.push({ kind: "policy", id: "bankroll", detail: "no invested funds" });
  return quote(snapshot, "withdraw", { type: "withdraw" }, constraints, 995);
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
  const industrial = paperclipsPhase(snapshot) !== "business";
  const gifts = snapshot.resources[paperclipsResources.swarmGifts.id] ?? 0;
  const processors = snapshot.allocations.compute?.processors ?? 0;
  const memory = snapshot.allocations.compute?.memory ?? 0;
  const constraints: ConstraintEvidence[] = [];
  if (industrial && gifts < 1)
    constraints.push({ kind: "insufficient-input", id: "swarm-gifts", detail: "one gift" });
  if (!industrial && processors + memory >= trust)
    constraints.push({ kind: "insufficient-input", id: "trust", detail: "unassigned trust" });
  return [
    quote(
      snapshot,
      "compute:memory",
      { type: "compute", target: "memory" },
      constraints,
      memory < 300 ? 850 : 40,
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
  const prerequisite = paperclipsMachinePrerequisite(id);
  if (prerequisite && !snapshot.progression.upgrades[prerequisite])
    constraints.push({ kind: "prerequisite", id: prerequisite, detail: id });
  const target = paperclipsMachineTarget(id);
  if (count >= target)
    constraints.push({ kind: "policy", id, detail: `campaign target ${target}` });
  const currencyId =
    id === "auto-clipper" || id === "mega-clipper" || id === "marketing" ? "funds" : "clips";
  const isDrone = id === "harvester" || id === "wire-drone";
  const factories = snapshot.purchaseCounts[paperclipsBuyable("factory").id] ?? 0;
  if (isDrone && factories === 0 && count >= 1) {
    constraints.push({ kind: "policy", id: "factory-capital", detail: "reserve first factory" });
  }
  const batchSize = isDrone && factories > 0 ? 1_000 : 1;
  const maximum = isDrone ? Math.min(batchSize, Math.max(1, target - count)) : 1;
  const affordable = buyable.curve.maxAffordable(
    snapshot.resources[currencyId] ?? 0,
    count,
    maximum,
  );
  const purchaseCount = Math.max(1, affordable);
  requireAmount(snapshot, currencyId, buyable.curve.totalCost(count, purchaseCount), constraints);
  return quote(
    snapshot,
    `buy:${id}`,
    { type: "buy", id, count: purchaseCount },
    constraints,
    paperclipsMachineRank(id, count),
  );
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
