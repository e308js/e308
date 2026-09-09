import type { Snapshot } from "@e308/core";
import type { ConstraintEvidence, LegalActionQuote } from "@e308/core/testing";
import type { PaperclipsIntent } from "./types.js";

export function requireAmount(
  snapshot: Snapshot<number>,
  id: string,
  amount: number,
  constraints: ConstraintEvidence[],
): void {
  if ((snapshot.resources[id] ?? 0) < amount)
    constraints.push({ kind: "insufficient-input", id, detail: String(amount) });
}

export function quote(
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
