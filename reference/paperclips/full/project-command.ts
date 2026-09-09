import type { Command, Resource, Transaction } from "../../../packages/core/src/index.js";
import { spend } from "./command-cost.js";
import { computeAllocation, paperclipsBuyables, paperclipsResources } from "./model.js";
import {
  allPaperclipsProjects,
  businessProjects,
  industryProjects,
  type PaperclipsProject,
  spaceProjects,
} from "./projects.js";

export function paperclipsProjectCommand(id: string): Command<number> {
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
  if (!project.repeatable && transaction.hasProgress("upgrade", project.id)) {
    transaction.reject({ code: "locked", prerequisiteIds: ["unowned-project"] });
  }
  const missing = project.prerequisites.filter((id) => !transaction.hasProgress("upgrade", id));
  if (missing.length > 0) transaction.reject({ code: "locked", prerequisiteIds: missing });
  requireProjectUnlock(transaction, project);
  spendProjectCosts(transaction, project);
  if (!project.repeatable) transaction.setProgress("upgrade", project.id);
  applyProjectEffect(transaction, project);
  applyTransition(transaction, project);
}

function applyProjectEffect(transaction: Transaction<number>, project: PaperclipsProject): void {
  const effect = project.effect;
  if (effect.kind === "clipper-boost") {
    const resource =
      effect.target === "auto"
        ? paperclipsResources.autoClipperBoost
        : paperclipsResources.megaClipperBoost;
    transaction.add(resource, effect.amount);
  }
  if (effect.kind === "wire-supply") {
    multiply(transaction, paperclipsResources.wireSupply, effect.multiplier);
  }
  if (effect.kind === "wire-refill") {
    transaction.set(paperclipsResources.wire, transaction.get(paperclipsResources.wireSupply));
  }
  if (effect.kind === "marketing") {
    multiply(transaction, paperclipsResources.marketingEffectiveness, effect.multiplier);
  }
  if (effect.kind === "trust") applyTrustEffect(transaction, effect.amount, effect.stockGain);
  if (effect.kind === "demand") {
    multiply(transaction, paperclipsResources.demandBoost, effect.multiplier);
    applyTrustEffect(transaction, effect.trust);
  }
  if (effect.kind === "goodwill") applyGoodwill(transaction, effect.repeatable);
  if (effect.kind === "photonic-chip") {
    transaction.add(paperclipsResources.photonicChips, 1);
    transaction.add(paperclipsResources.photonicChipCost, 5_000);
  }
  if (effect.kind === "strategy") {
    transaction.add(paperclipsResources.strategyCount, 1);
    transaction.add(paperclipsResources.tournamentCost, 1_000);
  }
  if (effect.kind === "theory-of-mind") {
    transaction.set(paperclipsResources.yomiBoost, 2);
    transaction.set(paperclipsResources.tournamentCost, 16_000);
  }
  if (effect.kind === "drone-rate") {
    multiply(transaction, paperclipsResources.droneRateMultiplier, effect.multiplier);
  }
  if (effect.kind === "drone-cohesion") {
    transaction.set(paperclipsResources.droneBoost, effect.multiplier);
  }
  if (effect.kind === "unlock" && effect.system === "investment") {
    transaction.set(paperclipsResources.investmentLevel, 1);
  }
}

function applyTrustEffect(transaction: Transaction<number>, amount: number, stockGain = 0): void {
  transaction.add(paperclipsResources.trust, amount);
  preserveComputeCapacity(transaction);
  if (stockGain) transaction.add(paperclipsResources.stockGainThreshold, stockGain);
}

function requireProjectUnlock(transaction: Transaction<number>, project: PaperclipsProject): void {
  const trigger = project.trigger;
  if (trigger?.kind === "resource") {
    const resource = Object.values(paperclipsResources).find(({ id }) => id === trigger.id);
    const value = resource
      ? transaction.get(resource)
      : computeTriggerValue(transaction, trigger.id);
    if (value < trigger.minimum) rejectSourceTrigger(transaction, project.id);
  }
  if (trigger?.kind === "purchase") {
    const buyable = Object.values(paperclipsBuyables).find(({ id }) => id === trigger.id);
    if (!buyable || transaction.getPurchase(buyable.id) < trigger.minimum) {
      rejectSourceTrigger(transaction, project.id);
    }
  }
  if (trigger?.kind === "purchase-total") {
    const total = trigger.ids.reduce((sum, id) => sum + transaction.getPurchase(id), 0);
    if (total < trigger.minimum) rejectSourceTrigger(transaction, project.id);
  }
  requireSpecialTrigger(transaction, project.id);
}

function requireSpecialTrigger(transaction: Transaction<number>, id: string): void {
  if (id === "beg-for-more-wire") {
    const wireCost = transaction.get(paperclipsResources.wireCost);
    const blocked =
      transaction.get(paperclipsResources.bankroll) >= wireCost ||
      transaction.get(paperclipsResources.funds) >= wireCost ||
      transaction.get(paperclipsResources.wire) >= 1 ||
      transaction.get(paperclipsResources.unsold) >= 1 ||
      transaction.get(paperclipsResources.trust) < -100;
    if (blocked) rejectSourceTrigger(transaction, id);
  }
  if (id === "creativity") {
    const memory = transaction.getAllocation(computeAllocation.id, "memory");
    if (transaction.get(paperclipsResources.operations) < memory * 1_000) {
      rejectSourceTrigger(transaction, id);
    }
  }
  if (id === "photonic-chip" && transaction.get(paperclipsResources.photonicChips) >= 10) {
    rejectSourceTrigger(transaction, id);
  }
  if (
    id === "spectral-froth-annealment" &&
    transaction.get(paperclipsResources.wireSupply) < 5_000
  ) {
    rejectSourceTrigger(transaction, id);
  }
  const trust = transaction.get(paperclipsResources.trust);
  if (id === "token-of-goodwill" && (trust < 85 || trust >= 100))
    rejectSourceTrigger(transaction, id);
  if (id === "another-token-of-goodwill" && trust >= 100) rejectSourceTrigger(transaction, id);
}

function spendProjectCosts(transaction: Transaction<number>, project: PaperclipsProject): void {
  if (project.operations) spend(transaction, paperclipsResources.operations, project.operations);
  if (project.creativity) spend(transaction, paperclipsResources.creativity, project.creativity);
  if (project.yomi) spend(transaction, paperclipsResources.yomi, project.yomi);
  if (project.funds) spend(transaction, paperclipsResources.funds, project.funds);
  if (project.clips) spend(transaction, paperclipsResources.clips, project.clips);
  if (project.trustCost) {
    if (project.id === "beg-for-more-wire") {
      transaction.add(paperclipsResources.trust, -project.trustCost);
    } else {
      spend(transaction, paperclipsResources.trust, project.trustCost);
    }
  }
  if (project.effect.kind === "photonic-chip") {
    spend(
      transaction,
      paperclipsResources.operations,
      transaction.get(paperclipsResources.photonicChipCost),
    );
  }
  if (project.effect.kind === "goodwill" && project.effect.repeatable) {
    spend(transaction, paperclipsResources.funds, transaction.get(paperclipsResources.bribe));
  }
}

function applyTransition(transaction: Transaction<number>, project: PaperclipsProject): void {
  if (project.id === "release-hypnodrones") {
    transaction.setProgress("milestone", "industry-phase");
    transaction.set(paperclipsResources.nanoWire, transaction.get(paperclipsResources.wire));
    transaction.setPurchase(paperclipsBuyables.autoClipper.id, 0);
    transaction.setPurchase(paperclipsBuyables.megaClipper.id, 0);
    transaction.set(paperclipsResources.trust, 0);
  }
  if (project.id === "space-exploration") {
    transaction.setProgress("milestone", "space-phase");
    transaction.set(paperclipsResources.probeTrust, 20);
    transaction.set(paperclipsResources.probes, 1);
  }
  if (project.id === "glory") transaction.add(paperclipsResources.glory, 1);
  if (project.effect.kind === "ending") transaction.setWon(true);
}

function applyGoodwill(transaction: Transaction<number>, repeatable: boolean): void {
  applyTrustEffect(transaction, 1);
  if (repeatable) multiply(transaction, paperclipsResources.bribe, 2);
}

function preserveComputeCapacity(transaction: Transaction<number>): void {
  transaction.set(
    paperclipsResources.computeCapacity,
    Math.max(
      transaction.get(paperclipsResources.computeCapacity),
      transaction.get(paperclipsResources.trust),
    ),
  );
}

function multiply(
  transaction: Transaction<number>,
  resource: Resource<number>,
  multiplier: number,
): void {
  transaction.set(resource, transaction.get(resource) * multiplier);
}

function computeTriggerValue(transaction: Transaction<number>, id: string): number {
  if (id === "processors") return transaction.getAllocation(computeAllocation.id, "processors");
  return Number.NEGATIVE_INFINITY;
}

function rejectSourceTrigger(transaction: Transaction<number>, id: string): never {
  return transaction.reject({ code: "disabled", actionId: id, reasonKey: "source-trigger" });
}

function requireProjectPhase(transaction: Transaction<number>, project: PaperclipsProject): void {
  if (project.persistent) return;
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
