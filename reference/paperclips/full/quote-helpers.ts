import type { Snapshot as EngineSnapshot } from "../../../packages/core/src/index.js";
import type {
  LegalActionQuote as ActionQuote,
  ConstraintEvidence as QuoteConstraint,
} from "../../../packages/core/src/testing/index.js";
import type { PaperclipsIntent } from "./types.js";

export function requireAmount(
  snapshot: EngineSnapshot<number>,
  id: string,
  amount: number,
  constraints: QuoteConstraint[],
): void {
  if ((snapshot.resources[id] ?? 0) < amount)
    constraints.push({ kind: "insufficient-input", id, detail: String(amount) });
}

export function quote(
  snapshot: EngineSnapshot<number>,
  id: string,
  intent: PaperclipsIntent,
  constraints: readonly QuoteConstraint[],
  rank: number,
): ActionQuote<PaperclipsIntent> {
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
