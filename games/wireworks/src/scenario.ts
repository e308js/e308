import { createGame, type Snapshot } from "@e308/core";
import type {
  ConstraintEvidence,
  HarnessScenario,
  HarnessValue,
  LegalActionQuote,
} from "@e308/core/testing";
import { wireworksBuyables, wireworksDefinition, wireworksProjects } from "./content.js";
import { type WireworksBand, type WireworksIntent, wireworksCommand } from "./runtime.js";

export interface WireworksObservation extends Readonly<Record<string, HarnessValue>> {
  readonly era: string;
  readonly cash: number;
  readonly clips: number;
  readonly demand: number;
  readonly drones: number;
  readonly extruders: number;
  readonly assemblers: number;
  readonly projects: readonly string[];
}

export type WireworksActionIntent = Exclude<WireworksIntent, { readonly type: "advance" }>;
export type WireworksStrategy = "hybrid" | "volume" | "premium";

export function wireworksScenario(
  strategy: WireworksStrategy = "hybrid",
): HarnessScenario<number, WireworksObservation, WireworksActionIntent> {
  return {
    id: "wireworks",
    contentVersion: "1.1.0",
    contentDigest: "wireworks-1.1.0-production-network-2026-09-09",
    parameters: { strategy },
    definition: wireworksDefinition,
    goals: [
      {
        id: "final-expansion",
        evaluate: (snapshot) =>
          snapshot.progression.won
            ? { kind: "reached" }
            : { kind: "pending", constraints: projectConstraints(snapshot) },
      },
    ],
    create: () => createGame(wireworksDefinition),
    observe: (snapshot) => ({
      era: era(snapshot),
      cash: snapshot.resources.cash ?? 0,
      clips: snapshot.resources.clips ?? 0,
      demand: snapshot.resources.demand ?? 0,
      drones: snapshot.resources.drones ?? 0,
      extruders: snapshot.purchaseCounts[wireworksBuyables.extruder.id] ?? 0,
      assemblers: snapshot.purchaseCounts[wireworksBuyables.assembler.id] ?? 0,
      projects: Object.keys(snapshot.progression.upgrades),
    }),
    quote: (snapshot) => quotes(snapshot, strategy),
    command: (intent, snapshot) => wireworksCommand(snapshot, intent),
    sample: (snapshot) => ({
      cash: String(snapshot.resources.cash ?? 0),
      clips: String(snapshot.resources.clips ?? 0),
      matter: String(snapshot.resources.matter ?? 0),
      demand: String(snapshot.resources.demand ?? 0),
      era: era(snapshot),
    }),
    milestones: (snapshot) => [
      ...Object.keys(snapshot.progression.upgrades),
      ...(snapshot.progression.won ? ["ending"] : []),
    ],
    diagnostics: () => ({ overflow: 0, resetRecoveries: 0, taskBlocks: 0 }),
  };
}

function quotes(
  snapshot: Snapshot<number>,
  strategy: WireworksStrategy,
): readonly LegalActionQuote<WireworksActionIntent>[] {
  const projects = projectQuotes(snapshot);
  const sales = (["volume", "standard", "premium"] as const).map((band) =>
    saleQuote(snapshot, band, strategy),
  );
  return [...projects, ...operationQuotes(snapshot), ...sales];
}

function operationQuotes(
  snapshot: Snapshot<number>,
): readonly LegalActionQuote<WireworksActionIntent>[] {
  const result: LegalActionQuote<WireworksActionIntent>[] = [];
  const matter = snapshot.resources.matter ?? 0;
  const cash = snapshot.resources.cash ?? 0;
  const storage = snapshot.resources.storage ?? 0;
  const supplyConstraints: ConstraintEvidence[] = [];
  if (cash < 10)
    supplyConstraints.push({ kind: "insufficient-input", id: "cash", detail: "10 cash" });
  if (matter + 200 > 500 + storage * 1_000)
    supplyConstraints.push({ kind: "capacity", id: "matter", detail: "200 feedstock" });
  result.push({
    id: "supply",
    revision: snapshot.revision.toString(),
    intent: { type: "supply" },
    legal: supplyConstraints.length === 0,
    useful: !snapshot.progression.upgrades["autonomous-control"],
    rank: matter < 100 ? 90 : 15,
    constraints: supplyConstraints,
  });
  for (const machine of ["extruder", "assembler"] as const)
    result.push(machineQuote(snapshot, machine));
  const wire = snapshot.resources.wire ?? 0;
  result.push({
    id: "make",
    revision: snapshot.revision.toString(),
    intent: { type: "make" },
    legal: wire >= 1,
    useful: (snapshot.purchaseCounts[wireworksBuyables.assembler.id] ?? 0) === 0,
    rank: 10,
    constraints: wire < 1 ? [{ kind: "insufficient-input", id: "wire", detail: "1 wire" }] : [],
  });
  return [...result, ...allocationQuotes(snapshot)];
}

function machineQuote(
  snapshot: Snapshot<number>,
  machine: "extruder" | "assembler",
): LegalActionQuote<WireworksActionIntent> {
  const buyable = wireworksBuyables[machine];
  const owned = snapshot.purchaseCounts[buyable.id] ?? 0;
  const cost = buyable.curve.unitCost(owned);
  const cash = snapshot.resources.cash ?? 0;
  const other =
    snapshot.purchaseCounts[
      wireworksBuyables[machine === "extruder" ? "assembler" : "extruder"].id
    ] ?? 0;
  return {
    id: `buy-${machine}`,
    revision: snapshot.revision.toString(),
    intent: { type: "buy-machine", machine, count: 1 },
    legal: cash >= cost,
    useful: owned < 20,
    rank: owned < 8 ? (machine === "assembler" && owned < other ? 80 : 65) : 25,
    constraints:
      cash < cost ? [{ kind: "insufficient-input", id: "cash", detail: `${cost} cash` }] : [],
  };
}

function allocationQuotes(
  snapshot: Snapshot<number>,
): readonly LegalActionQuote<WireworksActionIntent>[] {
  if (!snapshot.progression.upgrades["powered-extrusion"]) return [];
  const assigned = snapshot.allocations.grid ?? {};
  const power = snapshot.resources.power ?? 0;
  const free = power - (assigned.extrusion ?? 0) - (assigned.assembly ?? 0);
  const quotes: LegalActionQuote<WireworksActionIntent>[] = [];
  for (const target of ["extrusion", "assembly"] as const) {
    const current = assigned[target] ?? 0;
    for (const change of [-1, 1] as const) {
      const amount = current + change;
      if (amount < 0 || (change > 0 && free < 1)) continue;
      quotes.push({
        id: `allocate-${target}:${change > 0 ? "up" : "down"}`,
        revision: snapshot.revision.toString(),
        intent: { type: "allocate", target, amount },
        legal: amount <= power,
        useful: true,
        rank: change > 0 ? (target === "assembly" ? 95 : 94) : 5,
        constraints: [],
      });
    }
  }
  return quotes;
}

function projectQuotes(
  snapshot: Snapshot<number>,
): readonly LegalActionQuote<WireworksActionIntent>[] {
  return wireworksProjects
    .filter((project) => !snapshot.progression.upgrades[project.id])
    .filter((project) => {
      if (project.id === "durable-drive" && snapshot.progression.upgrades["throughput-drive"])
        return false;
      if (project.id === "throughput-drive" && snapshot.progression.upgrades["durable-drive"])
        return false;
      return true;
    })
    .map((project) => {
      const cost = project.costs[0]?.[1] ?? 0;
      const constraints = projectBlockers(snapshot, project.id, project.prerequisiteIds, cost);
      return {
        id: `project:${project.id}`,
        revision: snapshot.revision.toString(),
        intent: { type: "project", id: project.id },
        legal: constraints.length === 0,
        useful: true,
        rank: 100,
        constraints,
      };
    });
}

function saleQuote(
  snapshot: Snapshot<number>,
  band: WireworksBand,
  strategy: WireworksStrategy,
): LegalActionQuote<WireworksActionIntent> {
  const quantity = band === "volume" ? 20 : band === "standard" ? 10 : 5;
  const demand = band === "volume" ? 5 : band === "standard" ? 10 : 20;
  const constraints: ConstraintEvidence[] = [];
  if ((snapshot.resources.clips ?? 0) < quantity)
    constraints.push({ kind: "insufficient-input", id: "clips", detail: `${quantity} clips` });
  if ((snapshot.resources.demand ?? 0) < demand)
    constraints.push({ kind: "insufficient-input", id: "demand", detail: `${demand} demand` });
  return {
    id: `sell:${band}`,
    revision: snapshot.revision.toString(),
    intent: { type: "sell", band, quantity },
    legal: constraints.length === 0,
    useful: !snapshot.progression.won && (strategy === "hybrid" || strategy === band),
    rank: band === "premium" ? 50 : band === "volume" ? 40 : 30,
    constraints,
  };
}

function projectBlockers(
  snapshot: Snapshot<number>,
  id: string,
  prerequisites: readonly string[],
  cost: number,
): ConstraintEvidence[] {
  const missing = prerequisites.filter((entry) => !snapshot.progression.upgrades[entry]);
  const blockers: ConstraintEvidence[] = missing.map((entry) => ({
    kind: "prerequisite",
    id: entry,
    detail: `required by ${id}`,
  }));
  if (
    id === "autonomous-control" &&
    !snapshot.progression.upgrades["durable-drive"] &&
    !snapshot.progression.upgrades["throughput-drive"]
  )
    blockers.push({
      kind: "prerequisite",
      id: "doctrine",
      detail: "choose an engineering doctrine",
    });
  if ((snapshot.resources.cash ?? 0) < cost)
    blockers.push({ kind: "insufficient-input", id: "cash", detail: `${cost} cash` });
  const threshold =
    id === "orbital-contract"
      ? 10
      : id === "launch-array"
        ? 50
        : id === "final-expansion"
          ? 200
          : 0;
  if ((snapshot.resources.drones ?? 0) < threshold)
    blockers.push({ kind: "prerequisite", id: "drones", detail: `${threshold} drones` });
  return blockers;
}

function projectConstraints(snapshot: Snapshot<number>): ConstraintEvidence[] {
  const pending = wireworksProjects.find(
    (project) => project.id !== "throughput-drive" && !snapshot.progression.upgrades[project.id],
  );
  return pending ? [{ kind: "prerequisite", id: pending.id, detail: "next project" }] : [];
}

function era(snapshot: Snapshot<number>): string {
  if (snapshot.progression.upgrades["autonomous-control"]) return "autonomy";
  if (snapshot.progression.upgrades["powered-extrusion"]) return "industry";
  return "workshop";
}
