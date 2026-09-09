import type { Snapshot } from "../../../packages/core/src/index.js";

export type PaperclipsPhase = "business" | "industry" | "space" | "complete";

export type PaperclipsIntent =
  | { readonly type: "make-clip"; readonly count?: number }
  | { readonly type: "buy-wire" }
  | { readonly type: "set-price"; readonly price: number }
  | { readonly type: "buy"; readonly id: PaperclipsBuyableId }
  | { readonly type: "compute"; readonly target: "processor" | "memory" }
  | { readonly type: "quantum-compute" }
  | { readonly type: "allocate-probe"; readonly target: ProbeTarget; readonly amount: number }
  | { readonly type: "project"; readonly id: string }
  | { readonly type: "tournament"; readonly strategy: PaperclipsStrategy }
  | { readonly type: "invest"; readonly amount: number }
  | { readonly type: "withdraw" };

export type PaperclipsBuyableId =
  | "auto-clipper"
  | "mega-clipper"
  | "marketing"
  | "harvester"
  | "wire-drone"
  | "factory"
  | "solar-farm"
  | "battery";

export type ProbeTarget =
  | "speed"
  | "navigation"
  | "replication"
  | "hazard"
  | "factory"
  | "harvester"
  | "wire"
  | "combat";

export type PaperclipsStrategy =
  | "random"
  | "a100"
  | "b100"
  | "greedy"
  | "generous"
  | "minimax"
  | "tit-for-tat"
  | "beat-last";

export interface PaperclipsObservation extends Readonly<Record<string, string | number | boolean>> {
  readonly phase: PaperclipsPhase;
  readonly clips: number;
  readonly funds: number;
  readonly wire: number;
  readonly operations: number;
  readonly creativity: number;
  readonly yomi: number;
  readonly projects: number;
}

export function paperclipsPhase(snapshot: Snapshot<number>): PaperclipsPhase {
  if (snapshot.progression.won) return "complete";
  if (snapshot.progression.milestones["space-phase"]) return "space";
  if (snapshot.progression.milestones["industry-phase"]) return "industry";
  return "business";
}
