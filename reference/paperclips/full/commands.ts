import {
  allocationCommand,
  buyCommand,
  type Command,
  type Snapshot,
  type Transaction,
} from "../../../packages/core/src/index.js";
import { paperclipsBuyable } from "./buyable-map.js";
import {
  computeAllocation,
  paperclipsBuyables,
  paperclipsResources,
  probeAllocation,
} from "./model.js";
import {
  allPaperclipsProjects,
  businessProjects,
  industryProjects,
  type PaperclipsProject,
  spaceProjects,
} from "./projects.js";
import type { PaperclipsBuyableId, PaperclipsIntent, PaperclipsStrategy } from "./types.js";

export function paperclipsCommand(
  snapshot: Snapshot<number>,
  intent: PaperclipsIntent,
): Command<number> {
  if (intent.type === "make-clip") return makeClip();
  if (intent.type === "buy-wire") return buyWire();
  if (intent.type === "set-price") return setPrice(intent.price);
  if (intent.type === "buy") return buyMachine(intent.id);
  if (intent.type === "compute") return addCompute(snapshot, intent.target);
  if (intent.type === "allocate-probe")
    return allocationCommand(probeAllocation, intent.target, intent.amount);
  if (intent.type === "project") return buyProject(intent.id);
  if (intent.type === "tournament") return tournament(intent.strategy);
  if (intent.type === "invest") return invest(intent.amount);
  return withdraw();
}

function makeClip(): Command<number> {
  return {
    id: "make-clip",
    execute(transaction) {
      requirePhase(transaction, "business");
      spend(transaction, paperclipsResources.wire, 1);
      transaction.add(paperclipsResources.clips, 1);
      transaction.add(paperclipsResources.unsold, 1);
      transaction.add(paperclipsResources.manualClips, 1);
      transaction.addProduction(paperclipsResources.clips.id, 1);
    },
  };
}

function buyWire(): Command<number> {
  return {
    id: "buy-wire",
    execute(transaction) {
      requirePhase(transaction, "business");
      const cost = transaction.get(paperclipsResources.wireCost);
      spend(transaction, paperclipsResources.funds, cost);
      const extrusion = wireMultiplier(transaction);
      transaction.add(
        paperclipsResources.wire,
        transaction.get(paperclipsResources.wireSupply) * extrusion,
      );
      transaction.set(
        paperclipsResources.wireCost,
        Math.min(
          40,
          Math.max(15, cost * (0.85 + transaction.random(["wire-market"]).uniform() * 0.2)),
        ),
      );
    },
  };
}

function setPrice(price: number): Command<number> {
  return {
    id: "set-price",
    execute(transaction) {
      requirePhase(transaction, "business");
      if (!Number.isFinite(price) || price < 0.01 || price > 100)
        transaction.reject({ code: "invalid-count", requested: price });
      transaction.set(paperclipsResources.price, price);
    },
  };
}

function buyMachine(id: PaperclipsBuyableId): Command<number> {
  const buyable = paperclipsBuyable(id);
  return {
    id: `buy:${id}`,
    execute(transaction) {
      requireMachinePhase(transaction, id);
      if (id === "mega-clipper" && !transaction.hasProgress("upgrade", "mega-clippers")) {
        transaction.reject({ code: "locked", prerequisiteIds: ["mega-clippers"] });
      }
      buyCommand(buyable, { mode: "exact", count: 1 }).execute(transaction);
      if (id === "marketing") {
        transaction.set(
          paperclipsResources.marketingLevel,
          transaction.getPurchase(paperclipsBuyables.marketing.id) + 1,
        );
      }
    },
  };
}

function addCompute(snapshot: Snapshot<number>, target: "processor" | "memory"): Command<number> {
  const allocationTarget = target === "processor" ? "processors" : "memory";
  const current = snapshot.allocations[computeAllocation.id]?.[allocationTarget] ?? 0;
  return allocationCommand(computeAllocation, allocationTarget, current + 1);
}

function buyProject(id: string): Command<number> {
  const project = allPaperclipsProjects.find((candidate) => candidate.id === id);
  return {
    id: `project:${id}`,
    execute(transaction) {
      if (!project) transaction.reject({ code: "invalid-target", id });
      requireProjectPhase(transaction, project as PaperclipsProject);
      applyProject(transaction, project as PaperclipsProject);
    },
  };
}

function applyProject(transaction: Transaction<number>, project: PaperclipsProject): void {
  if (transaction.hasProgress("upgrade", project.id)) {
    transaction.reject({ code: "locked", prerequisiteIds: ["unowned-project"] });
  }
  const missing = project.prerequisites.filter((id) => !transaction.hasProgress("upgrade", id));
  if (missing.length > 0) transaction.reject({ code: "locked", prerequisiteIds: missing });
  spendProjectCosts(transaction, project);
  transaction.setProgress("upgrade", project.id);
  if (project.effect === "wire" && project.id === "beg-for-more-wire") {
    transaction.set(paperclipsResources.wireSupply, 2_000);
  }
  if (project.effect === "demand") {
    transaction.set(paperclipsResources.demand, transaction.get(paperclipsResources.demand) * 1.5);
  }
  if (project.effect === "investment") transaction.set(paperclipsResources.investmentLevel, 1);
  applyTransition(transaction, project);
}

function spendProjectCosts(transaction: Transaction<number>, project: PaperclipsProject): void {
  if (project.operations) spend(transaction, paperclipsResources.operations, project.operations);
  if (project.creativity) spend(transaction, paperclipsResources.creativity, project.creativity);
  if (project.yomi) spend(transaction, paperclipsResources.yomi, project.yomi);
  if (project.clips) requireBalance(transaction, paperclipsResources.clips, project.clips);
  if (project.trust) {
    const used =
      transaction.getAllocation(computeAllocation.id, "processors") +
      transaction.getAllocation(computeAllocation.id, "memory");
    const trust = transaction.get(paperclipsResources.trust);
    if (trust - used < project.trust) {
      transaction.reject({
        code: "insufficient",
        resourceId: paperclipsResources.trust.id,
        required: used + project.trust,
        available: trust,
      });
    }
    transaction.add(paperclipsResources.trust, -project.trust);
  }
}

function applyTransition(transaction: Transaction<number>, project: PaperclipsProject): void {
  if (project.id === "release-hypnodrones") {
    transaction.setProgress("milestone", "industry-phase");
    transaction.add(paperclipsResources.clips, 900_000_000);
  }
  if (project.id === "space-exploration") {
    transaction.setProgress("milestone", "space-phase");
    transaction.set(paperclipsResources.probeTrust, 20);
    transaction.set(paperclipsResources.probes, 1);
  }
  if (project.id === "glory") transaction.add(paperclipsResources.glory, 1);
  if (project.effect === "ending") transaction.setWon(true);
}

function requireProjectPhase(transaction: Transaction<number>, project: PaperclipsProject): void {
  const industry = transaction.hasProgress("milestone", "industry-phase");
  const space = transaction.hasProgress("milestone", "space-phase");
  const valid = businessProjects.includes(project)
    ? !industry
    : industryProjects.includes(project)
      ? industry && !space
      : spaceProjects.includes(project) && space;
  if (!valid)
    transaction.reject({ code: "disabled", actionId: project.id, reasonKey: "phase-inactive" });
}

function requireMachinePhase(transaction: Transaction<number>, id: PaperclipsBuyableId): void {
  const business = id === "auto-clipper" || id === "mega-clipper" || id === "marketing";
  const industry = transaction.hasProgress("milestone", "industry-phase");
  const space = transaction.hasProgress("milestone", "space-phase");
  if ((business && industry) || (!business && (!industry || space))) {
    transaction.reject({ code: "disabled", actionId: id, reasonKey: "phase-inactive" });
  }
  const prerequisites: Partial<Record<PaperclipsBuyableId, string>> = {
    harvester: "harvester-drones",
    "wire-drone": "wire-drones",
    factory: "clip-factories",
    "solar-farm": "power-grid",
    battery: "power-grid",
  };
  const prerequisite = prerequisites[id];
  if (prerequisite && !transaction.hasProgress("upgrade", prerequisite)) {
    transaction.reject({ code: "locked", prerequisiteIds: [prerequisite] });
  }
}

function tournament(strategy: PaperclipsStrategy): Command<number> {
  return {
    id: `tournament:${strategy}`,
    execute(transaction) {
      requireOwned(transaction, "strategic-modeling");
      spend(transaction, paperclipsResources.operations, 1_000);
      const skill = strategyScore(strategy);
      const draw = transaction.random(["tournament", strategy]).uniform();
      const reward = Math.floor(500 + skill * 1_000 + draw * 500);
      transaction.add(paperclipsResources.yomi, reward);
      transaction.add(paperclipsResources.tournaments, 1);
    },
  };
}

function invest(amount: number): Command<number> {
  return {
    id: "invest",
    execute(transaction) {
      requireOwned(transaction, "algorithmic-trading");
      if (!Number.isFinite(amount) || amount <= 0)
        transaction.reject({ code: "invalid-count", requested: amount });
      spend(transaction, paperclipsResources.funds, amount);
      transaction.add(paperclipsResources.bankroll, amount);
    },
  };
}

function withdraw(): Command<number> {
  return {
    id: "withdraw",
    execute(transaction) {
      requireOwned(transaction, "algorithmic-trading");
      const bankroll = transaction.get(paperclipsResources.bankroll);
      transaction.set(paperclipsResources.bankroll, 0);
      transaction.add(paperclipsResources.funds, bankroll);
    },
  };
}

function wireMultiplier(transaction: Transaction<number>): number {
  if (transaction.hasProgress("upgrade", "microlattice-shapecasting")) return 2;
  if (transaction.hasProgress("upgrade", "optimized-wire-extrusion")) return 1.75;
  if (transaction.hasProgress("upgrade", "improved-wire-extrusion")) return 1.5;
  return 1;
}

function strategyScore(strategy: PaperclipsStrategy): number {
  if (strategy === "minimax" || strategy === "tit-for-tat") return 2;
  if (strategy === "greedy" || strategy === "beat-last") return 1.5;
  if (strategy === "a100" || strategy === "b100") return 1;
  return 0.75;
}

function requirePhase(transaction: Transaction<number>, phase: "business"): void {
  if (phase === "business" && transaction.hasProgress("milestone", "industry-phase")) {
    transaction.reject({ code: "disabled", actionId: phase, reasonKey: "phase-complete" });
  }
}

function requireOwned(transaction: Transaction<number>, id: string): void {
  if (!transaction.hasProgress("upgrade", id)) {
    transaction.reject({ code: "locked", prerequisiteIds: [id] });
  }
}

function spend(
  transaction: Transaction<number>,
  resource: (typeof paperclipsResources)[keyof typeof paperclipsResources],
  amount: number,
): void {
  requireBalance(transaction, resource, amount);
  transaction.add(resource, -amount);
}

function requireBalance(
  transaction: Transaction<number>,
  resource: (typeof paperclipsResources)[keyof typeof paperclipsResources],
  amount: number,
): void {
  const available = transaction.get(resource);
  if (available < amount) {
    transaction.reject({
      code: "insufficient",
      resourceId: resource.id,
      required: amount,
      available,
    });
  }
}
