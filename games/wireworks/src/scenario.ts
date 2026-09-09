import { createGame, type Snapshot } from "@e308/core";
import type {
  ConstraintEvidence,
  HarnessScenario,
  HarnessValue,
  LegalActionQuote,
} from "@e308/core/testing";
import { wireworksDefinition, wireworksProjects } from "./content.js";
import { type WireworksBand, type WireworksIntent, wireworksCommand } from "./runtime.js";

export interface WireworksObservation extends Readonly<Record<string, HarnessValue>> {
  readonly era: string;
  readonly cash: number;
  readonly clips: number;
  readonly demand: number;
  readonly projects: readonly string[];
}

export type WireworksActionIntent = Exclude<WireworksIntent, { readonly type: "advance" }>;

export function wireworksScenario(
  preferredBand: WireworksBand = "premium",
): HarnessScenario<number, WireworksObservation, WireworksActionIntent> {
  return {
    id: "wireworks",
    contentVersion: "1.0.0",
    contentDigest: "wireworks-1.0.0-2026-09-09",
    parameters: { preferredBand },
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
      projects: Object.keys(snapshot.progression.upgrades),
    }),
    quote: (snapshot) => quotes(snapshot, preferredBand),
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
  preferredBand: WireworksBand,
): readonly LegalActionQuote<WireworksActionIntent>[] {
  const projects = projectQuotes(snapshot);
  const sales = (["volume", "standard", "premium"] as const).map((band) =>
    saleQuote(snapshot, band, band === preferredBand ? 50 : 20),
  );
  return [...projects, ...sales];
}

function projectQuotes(
  snapshot: Snapshot<number>,
): readonly LegalActionQuote<WireworksActionIntent>[] {
  return wireworksProjects
    .filter((project) => !snapshot.progression.upgrades[project.id])
    .filter((project) => project.id !== "throughput-drive")
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
  rank: number,
): LegalActionQuote<WireworksActionIntent> {
  const quantity = band === "volume" ? 20 : band === "standard" ? 10 : 5;
  const demand = quantity * (band === "volume" ? 1 : band === "standard" ? 2 : 4);
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
    useful: !snapshot.progression.won,
    rank,
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
  if ((snapshot.resources.cash ?? 0) < cost)
    blockers.push({ kind: "insufficient-input", id: "cash", detail: `${cost} cash` });
  if (id === "autonomous-control" && !snapshot.progression.upgrades["durable-drive"])
    blockers.push({ kind: "prerequisite", id: "durable-drive", detail: "story choice required" });
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
