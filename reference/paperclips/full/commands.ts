import {
  allocationCommand,
  buyCommand,
  type Command,
  type Snapshot,
  type Transaction,
} from "../../../packages/core/src/index.js";
import { paperclipsBuyable } from "./buyable-map.js";
import { spend } from "./command-cost.js";
import {
  computeAllocation,
  paperclipsBuyables,
  paperclipsResources,
  probeAllocation,
} from "./model.js";
import { paperclipsProjectCommand } from "./project-command.js";
import { quantumOperationYield } from "./quantum.js";
import { paperclipsStrategyProjectIds } from "./strategy-state.js";
import type { PaperclipsBuyableId, PaperclipsIntent, PaperclipsStrategy } from "./types.js";
import { purchaseWire } from "./wire-purchase.js";

export function paperclipsCommand(
  snapshot: Snapshot<number>,
  intent: PaperclipsIntent,
): Command<number> {
  if (intent.type === "make-clip") return makeClip(intent.count ?? 1);
  if (intent.type === "buy-wire") return buyWire();
  if (intent.type === "set-price") return setPrice(intent.price);
  if (intent.type === "buy") return buyMachine(intent.id, intent.count ?? 1);
  if (intent.type === "compute") return addCompute(snapshot, intent.target);
  if (intent.type === "quantum-compute") return quantumCompute();
  if (intent.type === "allocate-probe")
    return allocationCommand(probeAllocation, intent.target, intent.amount);
  if (intent.type === "project") return paperclipsProjectCommand(intent.id);
  if (intent.type === "tournament") return tournament(intent.strategy);
  if (intent.type === "invest") return invest(intent.amount);
  return withdraw();
}

function makeClip(count: number): Command<number> {
  return {
    id: "make-clip",
    execute(transaction) {
      requirePhase(transaction, "business");
      if (!Number.isSafeInteger(count) || count < 1 || count > 1_000) {
        transaction.reject({ code: "invalid-count", requested: count });
      }
      const produced = Math.min(count, Math.floor(transaction.get(paperclipsResources.wire)));
      if (produced < 1) spend(transaction, paperclipsResources.wire, 1);
      transaction.add(paperclipsResources.wire, -produced);
      transaction.add(paperclipsResources.clips, produced);
      transaction.add(paperclipsResources.unsold, produced);
      transaction.add(paperclipsResources.manualClips, produced);
      transaction.addProduction(paperclipsResources.clips.id, produced);
    },
  };
}

function buyWire(): Command<number> {
  return {
    id: "buy-wire",
    execute(transaction) {
      requirePhase(transaction, "business");
      const purchased = purchaseWire(transaction, paperclipsResources);
      if (!purchased) {
        transaction.reject({
          code: "insufficient",
          resourceId: paperclipsResources.funds.id,
          required: transaction.get(paperclipsResources.wireCost),
          available: transaction.get(paperclipsResources.funds),
        });
      }
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

function buyMachine(id: PaperclipsBuyableId, count: number): Command<number> {
  const buyable = paperclipsBuyable(id);
  return {
    id: `buy:${id}`,
    execute(transaction) {
      requireMachinePhase(transaction, id);
      if (id === "mega-clipper" && !transaction.hasProgress("upgrade", "mega-clippers")) {
        transaction.reject({ code: "locked", prerequisiteIds: ["mega-clippers"] });
      }
      buyCommand(buyable, { mode: "exact", count }).execute(transaction);
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
  const allocation = allocationCommand(computeAllocation, allocationTarget, current + 1);
  return {
    id: allocation.id,
    execute(transaction) {
      const used =
        transaction.getAllocation(computeAllocation.id, "processors") +
        transaction.getAllocation(computeAllocation.id, "memory");
      const industrial = transaction.hasProgress("milestone", "industry-phase");
      if (industrial) {
        spend(transaction, paperclipsResources.swarmGifts, 1);
        transaction.add(paperclipsResources.computeCapacity, 1);
      } else if (used >= transaction.get(paperclipsResources.trust)) {
        transaction.reject({
          code: "insufficient",
          resourceId: paperclipsResources.trust.id,
          required: used + 1,
          available: transaction.get(paperclipsResources.trust),
        });
      }
      allocation.execute(transaction);
    },
  };
}

function quantumCompute(): Command<number> {
  return {
    id: "quantum-compute",
    execute(transaction) {
      const active = transaction.get(paperclipsResources.photonicChips);
      if (active < 1) transaction.reject({ code: "locked", prerequisiteIds: ["photonic-chip"] });
      const clock = transaction.get(paperclipsResources.quantumClock);
      let quantumOperations = quantumOperationYield(clock, active);
      const memory = transaction.getAllocation(computeAllocation.id, "memory");
      const operations = transaction.get(paperclipsResources.operations);
      const buffer = memory * 1_000 - operations;
      if (quantumOperations > buffer) {
        const temporary = transaction.get(paperclipsResources.temporaryOperations);
        const damper = temporary / 100 + 5;
        transaction.add(
          paperclipsResources.temporaryOperations,
          Math.ceil(quantumOperations / damper) - buffer,
        );
        quantumOperations = buffer;
      }
      transaction.add(paperclipsResources.operations, quantumOperations);
    },
  };
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
      requireStrategy(transaction, strategy);
      spend(
        transaction,
        paperclipsResources.operations,
        transaction.get(paperclipsResources.tournamentCost),
      );
      const skill = strategyScore(strategy);
      const draw = transaction.random(["tournament", strategy]).uniform();
      const reward =
        Math.floor(500 + skill * 1_000 + draw * 500) *
        transaction.get(paperclipsResources.yomiBoost);
      transaction.add(paperclipsResources.yomi, reward);
      transaction.add(paperclipsResources.tournaments, 1);
    },
  };
}

function requireStrategy(transaction: Transaction<number>, strategy: PaperclipsStrategy): void {
  const projectId = paperclipsStrategyProjectIds[strategy];
  if (projectId && !transaction.hasProgress("upgrade", projectId)) {
    transaction.reject({ code: "locked", prerequisiteIds: [projectId] });
  }
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
